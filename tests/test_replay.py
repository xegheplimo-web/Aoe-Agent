import json
import tempfile
import unittest
from pathlib import Path

import cv2
import numpy as np

from aoe1.runtime.replay import ReplayEnvironment
from aoe1.skills import TrainVillagerSkill


class FakePerception:
    def __init__(self, states):
        self.states = list(states)
        self.calls = 0

    def observe(self, _frame):
        state = self.states[min(self.calls, len(self.states) - 1)]
        self.calls += 1
        return dict(state)


def observation(food=500, pop=3, cap=12):
    return {
        "food": food,
        "wood": 100,
        "gold": 0,
        "stone": 0,
        "pop_used": pop,
        "pop_cap": cap,
        "ocr_raw": {},
    }


def write_run(directory, frames=3, with_events=True):
    run_dir = Path(directory)
    for index in range(frames):
        image = np.full((8, 8, 3), index * 40, dtype=np.uint8)
        cv2.imwrite(str(run_dir / f"{index:05d}.png"), image)
    # Non-frame artifacts must be ignored by replay.
    cv2.imwrite(
        str(run_dir / "selection_00001.png"),
        np.zeros((8, 8, 3), dtype=np.uint8),
    )
    if with_events:
        lines = [
            json.dumps(
                {
                    "type": "observation",
                    "elapsed": index * 0.5,
                    "image": f"{index:05d}.png",
                }
            )
            for index in range(frames)
        ]
        (run_dir / "events.jsonl").write_text("\n".join(lines), encoding="utf-8")
    return run_dir


class ReplayEnvironmentTests(unittest.TestCase):
    def test_replays_frames_through_perception_and_skills(self):
        with tempfile.TemporaryDirectory() as directory:
            run_dir = write_run(directory, frames=3)
            perception = FakePerception([observation()] * 3)
            env = ReplayEnvironment.from_run_dir(run_dir, perception, [TrainVillagerSkill(50)])
            events = env.run()
        self.assertEqual([e["image"] for e in events], ["00000.png", "00001.png", "00002.png"])
        self.assertEqual(events[0]["action"], "WAIT")
        self.assertEqual(events[1]["action"], "TRAIN_VILLAGER")
        self.assertTrue(all(e["live"] is False for e in events))
        # Elapsed timings restored from events.jsonl, not synthesized.
        self.assertEqual([e["elapsed"] for e in events], [0.0, 0.5, 1.0])

    def test_dry_run_never_registers_pending(self):
        # live=False: command intent only — sent() is never called, so the
        # skill re-arms on fresh observations instead of waiting on a
        # confirmation that cannot arrive.
        with tempfile.TemporaryDirectory() as directory:
            run_dir = write_run(directory, frames=5, with_events=False)
            perception = FakePerception([observation()] * 2 + [observation(pop=4)] * 3)
            env = ReplayEnvironment.from_run_dir(
                run_dir,
                perception,
                [TrainVillagerSkill(50, target_villagers=1)],
            )
            events = env.run()
        actions = [e["action"] for e in events]
        self.assertEqual(actions[1], "TRAIN_VILLAGER")
        self.assertEqual(actions[2], "WAIT")
        self.assertEqual(actions[-1], "TRAIN_VILLAGER")

    def test_missing_frames_are_skipped(self):
        with tempfile.TemporaryDirectory() as directory:
            run_dir = Path(directory)
            cv2.imwrite(
                str(run_dir / "00000.png"),
                np.zeros((8, 8, 3), dtype=np.uint8),
            )
            (run_dir / "00001.png").write_bytes(b"not a png")
            perception = FakePerception([observation()])
            env = ReplayEnvironment.from_run_dir(run_dir, perception, [TrainVillagerSkill(50)])
            events = env.run()
        self.assertEqual(len(events), 1)


if __name__ == "__main__":
    unittest.main()
