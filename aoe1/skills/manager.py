"""SkillManager — ordered dispatch.

This is the seam where a behavior tree / utility planner attaches (see
docs/ARCHITECTURE.md). For now there is one owner per tick: the first skill
that returns anything other than WAIT wins the tick. A skill that is pending
verification (e.g. waiting for population +1) returns WAIT and yields —
other skills may still act.
"""

from aoe1.skills.base import WAIT, SkillResult


class SkillManager:
    def __init__(self, skills):
        self.skills = list(skills)
        if not self.skills:
            raise ValueError("SkillManager can it nhat mot skill.")

    def get(self, name: str):
        for skill in self.skills:
            if skill.name == name:
                return skill
        raise KeyError(f"Khong co skill: {name}")

    def step(self, ctx, state) -> SkillResult:
        for skill in self.skills:
            result = skill.step(ctx, state)
            if result.action != WAIT:
                return result
        return SkillResult(WAIT, "Khong co skill nao san sang hanh dong.")
