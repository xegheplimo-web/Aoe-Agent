"""Session orchestration — wires platform, perception, skills and telemetry.

The observe → decide → verify → act → observe loop is preserved from the
original run.py; skills own execution, this loop owns session lifecycle.
"""

import math
import time
from pathlib import Path

import pytesseract

from aoe1.perception import Perception
from aoe1.platform import GameWindow, start_stop_key
from aoe1.runtime.session import SessionPaths
from aoe1.skills import STOP, SkillContext, SkillManager, TrainVillagerSkill
from aoe1.telemetry import EventRecorder
from aoe1.world import GameState


class AgentRuntime:
    """Run the villager experiment end to end; run.py is only the CLI."""

    def __init__(self, config, root: Path, live: bool = False):
        if not math.isfinite(float(config["tick_seconds"])) or config["tick_seconds"] < 0:
            raise ValueError("tick_seconds khong hop le.")
        threshold = float(config["template_threshold"])
        if not math.isfinite(threshold) or not 0 < threshold <= 1:
            raise ValueError("template_threshold phai nam trong (0, 1].")
        self.config = config
        self.root = Path(root)
        self.live = live
        pytesseract.pytesseract.tesseract_cmd = config["tesseract_cmd"]

    def build_manager(self) -> SkillManager:
        config = self.config
        return SkillManager(
            [
                TrainVillagerSkill(
                    config["villager_cost"],
                    config["target_villagers"],
                    config["confirmation_timeout_seconds"],
                )
            ]
        )

    def run(self, seconds: float) -> int:
        session = SessionPaths.create(self.root)
        stop = None
        game = None
        reason = "Chua bat dau."
        exit_code = 0

        try:
            perception = Perception(self.config, session.run_dir)
            manager = self.build_manager()
            if self.live:
                import pyautogui as pg

                pg.FAILSAFE = True

            stop = start_stop_key()
            game = GameWindow(
                self.config["exe_name"],
                stop,
                expected_size=self.config["client_size"],
            )
            if game.fingerprint() != self.config["fingerprint"]:
                raise RuntimeError("EXE/DAT khac luc calibration; khong gui input.")
            print(
                ("LIVE" if self.live else "DRY RUN")
                + ": Trong 5 giay chuyen sang game va chon nha chinh. F9 de dung."
            )
            if stop.wait(5):
                raise RuntimeError("Dung theo yeu cau F9.")

            ctx = SkillContext(
                config=self.config,
                live=self.live,
                game=game,
                perception=perception,
                stop=stop,
            )
            started = time.monotonic()
            with EventRecorder(session.run_dir) as recorder:
                ctx.recorder = recorder
                index = 0
                while True:
                    elapsed = time.monotonic() - started
                    if stop.is_set():
                        reason = "Dung theo yeu cau F9."
                        break
                    if elapsed >= seconds:
                        reason = "Da het gioi han thoi gian phien."
                        break

                    frame = game.capture()
                    image_name = f"{index:05d}.png"
                    recorder.save_frame(image_name, frame)
                    observation = perception.observe(frame)
                    state = GameState.from_observation(observation)
                    ctx.now = elapsed
                    ctx.frame_index = index
                    result = manager.step(ctx, state)
                    recorder.record(
                        "observation",
                        elapsed=elapsed,
                        image=image_name,
                        state=observation,
                        action=result.action,
                        reason=result.reason,
                        confirmed=manager.get("train_villager").confirmed,
                        live=self.live,
                    )
                    print(
                        f"[{index:05d}] {result.action} | food={observation['food']} "
                        f"pop={observation['pop_used']}/{observation['pop_cap']} "
                        f"| {result.reason}"
                    )

                    if result.action == STOP:
                        reason = result.reason
                        break
                    index += 1
                    if stop.wait(self.config["tick_seconds"]):
                        reason = "Dung theo yeu cau F9."
                        break
        except (Exception, KeyboardInterrupt) as error:
            reason = f"{type(error).__name__}: {error}"
            exit_code = 1
            print("ERROR:", reason)
        finally:
            if stop is not None:
                stop.set()
            if game is not None:
                game.close()
            (session.run_dir / "exit.txt").write_text(reason + "\n", encoding="utf-8")
            print("Phien:", session.run_dir)
            print("Ly do dung:", reason)
        return exit_code
