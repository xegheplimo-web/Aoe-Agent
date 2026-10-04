"""One-command-at-a-time villager policy for a controlled scenario."""


class EconomyPolicy:
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
        return "STOP", reason

    def decide(self, state, now):
        if self._stopped:
            return "STOP", "Policy da dung; can reset scenario cho phien moi."

        population = state.get("pop_used")
        capacity = state.get("pop_cap")
        food = state.get("food")

        if self._pending is not None:
            baseline, issued_at = self._pending
            if now - issued_at >= self.timeout_seconds:
                return self._finish("Qua han cho dan moi; khong lap lai lenh.")
            if population is None or capacity is None:
                self._pending_value = None
                self._pending_count = 0
                return "WAIT", "Dang cho; OCR dan so chua chac chan."
            if population == baseline:
                self._pending_value = None
                self._pending_count = 0
                return "WAIT", "Dang cho dan so tang; khong gui them lenh."
            if population != self._pending_value:
                self._pending_value = population
                self._pending_count = 1
            else:
                self._pending_count += 1
            if self._pending_count < 2:
                return "WAIT", "Cho them mot quan sat de kiem chung dan so."
            if population != baseline + 1:
                return self._finish("Dan so bien dong bat thuong; dung de kiem tra.")
            self.confirmed += 1
            self._pending = None
            self._pending_value = None
            self._pending_count = 0
            if self.confirmed >= self.target_villagers:
                return self._finish("Da xac nhan du so dan muc tieu.")
            return "WAIT", "Da xac nhan +1 dan; quan sat lai truoc lenh tiep."

        if self.confirmed >= self.target_villagers:
            return self._finish("Da dat muc tieu.")
        if population is not None and capacity is not None and population >= capacity:
            return self._finish("Het suc chua dan; can reset/doi scenario.")
        if food is None or population is None or capacity is None:
            self._candidate = None
            self._candidate_count = 0
            return "WAIT", "OCR chua du tin cay; khong gui input."
        if food < self.villager_cost:
            self._candidate = None
            self._candidate_count = 0
            return "WAIT", "Chua du thuc theo gia dang hien thi."

        candidate = (population, capacity)
        if self._candidate == candidate:
            self._candidate_count += 1
        else:
            self._candidate = candidate
            self._candidate_count = 1
        if self._candidate_count < 2:
            return "WAIT", "Can hai quan sat du dieu kien lien tiep."
        return "TRAIN_VILLAGER", "Hai quan sat du thuc va con cho dan."
