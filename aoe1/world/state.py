"""Typed world state.

`Perception.observe()` returns a raw observation dict (the telemetry event
schema). `GameState.from_observation` converts it into the typed model that
skills and the future behavior tree read. Fields may be None when perception
is uncertain — skills must treat None as "unknown", never as zero.
"""

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any


@dataclass
class Resources:
    food: int | None = None
    wood: int | None = None
    gold: int | None = None
    stone: int | None = None


@dataclass
class Population:
    used: int | None = None
    cap: int | None = None

    @property
    def full(self) -> bool:
        return self.used is not None and self.cap is not None and self.used >= self.cap

    @property
    def free(self) -> int | None:
        if self.used is None or self.cap is None:
            return None
        return self.cap - self.used


@dataclass
class GameState:
    resources: Resources = field(default_factory=Resources)
    population: Population = field(default_factory=Population)

    @classmethod
    def from_observation(cls, observation: Mapping[str, Any]) -> "GameState":
        return cls(
            resources=Resources(
                food=observation.get("food"),
                wood=observation.get("wood"),
                gold=observation.get("gold"),
                stone=observation.get("stone"),
            ),
            population=Population(
                used=observation.get("pop_used"),
                cap=observation.get("pop_cap"),
            ),
        )
