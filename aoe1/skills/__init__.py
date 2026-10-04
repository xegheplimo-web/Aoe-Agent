"""Skill layer — verified game actions.

A skill owns preconditions, execution, expected-effect verification, timeout
and abort for one game action. Planners see action names, never coordinates.
"""

from aoe1.skills.base import STOP, WAIT, Skill, SkillContext, SkillResult
from aoe1.skills.manager import SkillManager
from aoe1.skills.train_villager import TrainVillagerSkill

__all__ = [
    "STOP",
    "WAIT",
    "Skill",
    "SkillContext",
    "SkillManager",
    "SkillResult",
    "TrainVillagerSkill",
]
