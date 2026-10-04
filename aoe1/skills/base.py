"""Skill contract — see docs/ARCHITECTURE.md for the design rationale.

Every skill returns a `SkillResult` whose `action` is one of:
- the skill's command name (e.g. "TRAIN_VILLAGER") — preconditions hold,
  execute or dry-run intent,
- WAIT — keep observing; preconditions unmet or a pending command is
  unconfirmed,
- STOP — abort the session; safety boundary hit, unexpected state, timeout.

The action vocabulary is part of the events.jsonl schema consumed by
report.py and the dashboard; do not rename freely.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

WAIT = "WAIT"
STOP = "STOP"


@dataclass
class SkillResult:
    action: str
    reason: str


@dataclass
class SkillContext:
    """Shared services handed to skills each tick.

    `game` is None in dry-run and replay — skills must not send input then.
    `recorder` is None in replay when no artifacts should be written.
    `now`/`frame_index` are updated by the runtime every tick.
    """

    config: dict[str, Any]
    live: bool
    game: Any = None
    perception: Any = None
    recorder: Any = None
    stop: Any = None
    frame_index: int = 0
    now: float = 0.0


class Skill(ABC):
    name: str

    @abstractmethod
    def step(self, ctx: SkillContext, state) -> SkillResult:
        """Evaluate the world state once: decide, then execute if warranted."""


def skill_stopped(ctx: SkillContext) -> SkillResult | None:
    """Shared gate: caller-side F9 stop has priority over any skill logic."""
    if ctx.stop is not None and ctx.stop.is_set():
        return SkillResult(STOP, "Dung theo yeu cau F9.")
    return None
