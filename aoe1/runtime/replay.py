"""Deterministic offline replay — frames → perception → world state → skills.

No game window, no input, no Windows dependency. Perception and skills are
injected, so unit tests can substitute scripted fakes and verify decisions
deterministically on recorded session artifacts.
"""

import json
from pathlib import Path

import cv2

from aoe1.skills import SkillContext, SkillManager
from aoe1.world import GameState


class ReplayEnvironment:
    def __init__(self, frame_paths, perception, manager, tick_seconds=1.0, elapsed=None):
        self.frame_paths = [Path(p) for p in frame_paths]
        self.perception = perception
        self.manager = manager
        self.tick_seconds = tick_seconds
        self._elapsed = dict(elapsed or {})  # image name -> elapsed seconds

    @classmethod
    def from_run_dir(cls, run_dir, perception, skills, tick_seconds=1.0):
        """Build a replay from a recorded session directory.

        Frame images are the 00000.png-style captures; selection_*.png and
        other artifacts are skipped. Original elapsed timings are restored
        from events.jsonl so timeouts replay like the live run.
        """
        run_dir = Path(run_dir)
        frames = sorted(p for p in run_dir.glob("*.png") if p.stem.isdigit())
        elapsed = {}
        events_path = run_dir / "events.jsonl"
        if events_path.is_file():
            for line in events_path.read_text(encoding="utf-8-sig").splitlines():
                if not line.strip():
                    continue
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if event.get("type") != "observation":
                    continue
                try:
                    elapsed[event["image"]] = float(event["elapsed"])
                except (KeyError, TypeError, ValueError):
                    continue
        return cls(
            frames,
            perception,
            SkillManager(skills),
            tick_seconds=tick_seconds,
            elapsed=elapsed,
        )

    def run(self):
        """Play every frame once; return observation/decision events in order."""
        events = []
        ctx = SkillContext(config={}, live=False, perception=self.perception)
        for index, path in enumerate(self.frame_paths):
            frame = cv2.imread(str(path), cv2.IMREAD_COLOR)
            if frame is None:
                continue
            observation = self.perception.observe(frame)
            state = GameState.from_observation(observation)
            ctx.frame_index = index
            ctx.now = self._elapsed.get(path.name, index * self.tick_seconds)
            result = self.manager.step(ctx, state)
            events.append(
                {
                    "type": "observation",
                    "elapsed": ctx.now,
                    "image": path.name,
                    "state": observation,
                    "action": result.action,
                    "reason": result.reason,
                    "live": False,
                }
            )
        return events
