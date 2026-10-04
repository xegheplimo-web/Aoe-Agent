import unittest

import numpy as np

from aoe1.skills import (
    STOP,
    WAIT,
    SkillContext,
    SkillManager,
    TrainVillagerSkill,
)
from aoe1.world import GameState, Population, Resources


def make_state(food=500, pop=3, cap=12):
    return GameState(
        resources=Resources(food=food),
        population=Population(used=pop, cap=cap),
    )


class FakeGame:
    def __init__(self):
        self.pressed = []
        self.clicked = []

    def press(self, key):
        self.pressed.append(key)

    def capture(self):
        return np.zeros((8, 8, 3), dtype=np.uint8)

    def click(self, x, y):
        self.clicked.append((x, y))


class FakePerception:
    def __init__(self, scores=None):
        self.scores = scores or {"tc_marker": 0.99, "train_villager": 0.99}

    def ui_scores(self, _frame):
        return dict(self.scores)


class FakeRecorder:
    def __init__(self):
        self.events = []
        self.frames = []

    def record(self, event_type, **fields):
        self.events.append({"type": event_type, **fields})

    def save_frame(self, name, _image):
        self.frames.append(name)


def make_ctx(live, game=None, scores=None, recorder=None):
    return SkillContext(
        config={
            "town_center_hotkey": "h",
            "template_threshold": 0.97,
            "rois": {"train_villager": [10, 20, 30, 40]},
        },
        live=live,
        game=game,
        perception=FakePerception(scores),
        recorder=recorder,
        now=1.0,
        frame_index=7,
    )


class TrainVillagerStepTests(unittest.TestCase):
    def test_dry_run_issues_command_without_touching_game(self):
        skill = TrainVillagerSkill(50)
        ctx = make_ctx(live=False, game=FakeGame())
        skill.step(ctx, make_state())
        result = skill.step(ctx, make_state())
        self.assertEqual(result.action, "TRAIN_VILLAGER")
        self.assertEqual(ctx.game.pressed, [])
        self.assertEqual(ctx.game.clicked, [])
        self.assertIsNone(skill._pending)

    def test_live_execute_presses_hotkey_verifies_then_clicks(self):
        skill = TrainVillagerSkill(50)
        game = FakeGame()
        recorder = FakeRecorder()
        ctx = make_ctx(live=True, game=game, recorder=recorder)
        skill.step(ctx, make_state())
        result = skill.step(ctx, make_state())
        self.assertEqual(result.action, "TRAIN_VILLAGER")
        self.assertEqual(game.pressed, ["h"])
        self.assertEqual(game.clicked, [(10 + 30 // 2, 20 + 40 // 2)])
        self.assertEqual(recorder.frames, ["selection_00007.png"])
        issued = [e for e in recorder.events if e["type"] == "action_issued"]
        self.assertEqual(len(issued), 1)
        self.assertIsNotNone(skill._pending)

    def test_low_template_score_blocks_click(self):
        skill = TrainVillagerSkill(50)
        game = FakeGame()
        recorder = FakeRecorder()
        ctx = make_ctx(
            live=True,
            game=game,
            recorder=recorder,
            scores={"tc_marker": 0.10, "train_villager": 0.10},
        )
        skill.step(ctx, make_state())
        result = skill.step(ctx, make_state())
        self.assertEqual(result.action, STOP)
        self.assertEqual(game.clicked, [])
        blocked = [e for e in recorder.events if e["type"] == "action_blocked"]
        self.assertEqual(len(blocked), 1)

    def test_live_skill_verifies_pending_before_second_command(self):
        skill = TrainVillagerSkill(50)
        game = FakeGame()
        ctx = make_ctx(live=True, game=game)
        skill.step(ctx, make_state())
        skill.step(ctx, make_state())
        result = skill.step(ctx, make_state())
        self.assertEqual(result.action, WAIT)
        self.assertEqual(len(game.clicked), 1)


class SkillManagerTests(unittest.TestCase):
    def test_first_non_wait_wins(self):
        skill = TrainVillagerSkill(50)
        manager = SkillManager([skill])
        ctx = make_ctx(live=False)
        self.assertEqual(manager.step(ctx, make_state()).action, WAIT)
        self.assertEqual(manager.step(ctx, make_state()).action, "TRAIN_VILLAGER")

    def test_all_wait_returns_wait(self):
        skill = TrainVillagerSkill(50)
        skill.sent(3, 0)
        manager = SkillManager([skill])
        result = manager.step(make_ctx(live=False), make_state(pop=3))
        self.assertEqual(result.action, WAIT)

    def test_empty_manager_is_rejected(self):
        with self.assertRaises(ValueError):
            SkillManager([])


class GameStateTests(unittest.TestCase):
    def test_from_observation_maps_fields(self):
        state = GameState.from_observation(
            {
                "food": 500,
                "wood": 100,
                "gold": 0,
                "stone": 0,
                "pop_used": 3,
                "pop_cap": 12,
                "ocr_raw": {},
            }
        )
        self.assertEqual(state.resources.food, 500)
        self.assertEqual(state.population.used, 3)
        self.assertEqual(state.population.free, 9)
        self.assertFalse(state.population.full)

    def test_unknown_values_stay_none(self):
        state = GameState.from_observation({"pop_used": None, "pop_cap": None})
        self.assertIsNone(state.resources.food)
        self.assertIsNone(state.population.free)
        self.assertFalse(state.population.full)


if __name__ == "__main__":
    unittest.main()
