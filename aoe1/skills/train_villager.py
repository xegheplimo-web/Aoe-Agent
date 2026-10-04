"""Verified villager production — one command at a time, fail closed.

Migrated from the original EconomyPolicy (aoe1.policy, removed). The decide()
state machine is unchanged; step() adds the execute path that used to live in
run.py: hotkey-select the Town Center, verify UI templates, click inside the
calibrated ROI, then let later observations confirm population +1.
"""

import math

from aoe1.skills.base import STOP, WAIT, Skill, SkillResult, skill_stopped


class TrainVillagerSkill(Skill):
    name = "train_villager"
    command = "TRAIN_VILLAGER"

    def __init__(self, villager_cost, target_villagers=3, timeout_seconds=90):
        if villager_cost <= 0 or target_villagers < 1 or timeout_seconds <= 0:
            raise ValueError("Gia, muc tieu va timeout phai duong.")
        self.villager_cost = villager_cost
        self.target_villagers = target_villagers
        self.timeout_seconds = timeout_seconds
        self.confirmed = 0
        self._candidate = None
        self._candidate_count = 0
        self._pending = None
        self._pending_value = None
        self._pending_count = 0
        self._stopped = False

    def sent(self, population, now):
        if self._pending is not None:
            raise RuntimeError("Dang cho lenh truoc, khong gui them.")
        if population is None or population < 0:
            raise ValueError("Can dan so hop le truoc khi gui lenh.")
        self._pending = (population, now)
        self._pending_value = None
        self._pending_count = 0
        self._candidate = None
        self._candidate_count = 0

    def _finish(self, reason):
        self._stopped = True
        return STOP, reason

    def decide(self, state, now):
        """Pure precondition/verification logic — no I/O."""
        if self._stopped:
            return STOP, "Policy da dung; can reset scenario cho phien moi."

        population = state.population.used
        capacity = state.population.cap
        food = state.resources.food

        if self._pending is not None:
            baseline, issued_at = self._pending
            if now - issued_at >= self.timeout_seconds:
                return self._finish("Qua han cho dan moi; khong lap lai lenh.")
            if population is None or capacity is None:
                self._pending_value = None
                self._pending_count = 0
                return WAIT, "Dang cho; OCR dan so chua chac chan."
            if population == baseline:
                self._pending_value = None
                self._pending_count = 0
                return WAIT, "Dang cho dan so tang; khong gui them lenh."
            if population != self._pending_value:
                self._pending_value = population
                self._pending_count = 1
            else:
                self._pending_count += 1
            if self._pending_count < 2:
                return WAIT, "Cho them mot quan sat de kiem chung dan so."
            if population != baseline + 1:
                return self._finish("Dan so bien dong bat thuong; dung de kiem tra.")
            self.confirmed += 1
            self._pending = None
            self._pending_value = None
            self._pending_count = 0
            if self.confirmed >= self.target_villagers:
                return self._finish("Da xac nhan du so dan muc tieu.")
            return WAIT, "Da xac nhan +1 dan; quan sat lai truoc lenh tiep."

        if self.confirmed >= self.target_villagers:
            return self._finish("Da dat muc tieu.")
        if population is not None and capacity is not None and population >= capacity:
            return self._finish("Het suc chua dan; can reset/doi scenario.")
        if food is None or population is None or capacity is None:
            self._candidate = None
            self._candidate_count = 0
            return WAIT, "OCR chua du tin cay; khong gui input."
        if food < self.villager_cost:
            self._candidate = None
            self._candidate_count = 0
            return WAIT, "Chua du thuc theo gia dang hien thi."

        candidate = (population, capacity)
        if self._candidate == candidate:
            self._candidate_count += 1
        else:
            self._candidate = candidate
            self._candidate_count = 1
        if self._candidate_count < 2:
            return WAIT, "Can hai quan sat du dieu kien lien tiep."
        return self.command, "Hai quan sat du thuc va con cho dan."

    def step(self, ctx, state) -> SkillResult:
        action, reason = self.decide(state, ctx.now)
        if action != self.command or not ctx.live or ctx.game is None:
            return SkillResult(action, reason)
        return self._execute(ctx, state, reason)

    def _execute(self, ctx, state, reason) -> SkillResult:
        """Select Town Center, verify UI templates, click the train button."""
        stopped = skill_stopped(ctx)
        if stopped is not None:
            return stopped
        ctx.game.press(ctx.config["town_center_hotkey"])
        if ctx.stop is not None and ctx.stop.wait(0.25):
            return SkillResult(STOP, "Dung theo yeu cau F9.")
        selected = ctx.game.capture()
        image_name = f"selection_{ctx.frame_index:05d}.png"
        if ctx.recorder is not None:
            ctx.recorder.save_frame(image_name, selected)
        scores = ctx.perception.ui_scores(selected)
        threshold = float(ctx.config["template_threshold"])
        if not scores or any(
            not math.isfinite(score) or score < threshold for score in scores.values()
        ):
            if ctx.recorder is not None:
                ctx.recorder.record(
                    "action_blocked",
                    elapsed=ctx.now,
                    action=self.command,
                    reason="Giao dien khong khop anh mau.",
                    ui_scores=scores,
                    threshold=threshold,
                )
            self._stopped = True
            return SkillResult(STOP, "Giao dien khong khop anh mau; khong bam xin dan.")

        x, y, width, height = ctx.config["rois"]["train_villager"]
        ctx.game.click(x + width // 2, y + height // 2)
        self.sent(state.population.used, ctx.now)
        if ctx.recorder is not None:
            ctx.recorder.record(
                "action_issued",
                elapsed=ctx.now,
                action=self.command,
                ui_scores=scores,
                image=image_name,
            )
        return SkillResult(self.command, reason)
