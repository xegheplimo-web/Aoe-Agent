import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import cv2
import numpy as np

from aoe1.perception import Perception, crop
from aoe1.skills import TrainVillagerSkill
from aoe1.world import GameState, Population, Resources


class VisionTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        assets = root / "assets"
        assets.mkdir()
        rng = np.random.default_rng(7)
        self.frame = rng.integers(
            20,
            230,
            size=(32, 64, 3),
            dtype=np.uint8,
        )
        rois = {
            "food": [0, 0, 8, 8],
            "wood": [8, 0, 8, 8],
            "gold": [16, 0, 8, 8],
            "stone": [24, 0, 8, 8],
            "population": [32, 0, 16, 8],
            "tc_marker": [0, 16, 8, 8],
            "train_villager": [16, 16, 8, 8],
        }
        for name in ("tc_marker", "train_villager"):
            written = cv2.imwrite(
                str(assets / f"{name}.png"),
                crop(self.frame, rois[name]),
            )
            self.assertTrue(written)
        config = {"rois": rois, "ocr_min_confidence": 45}
        self.perception = Perception(config, root)

    def read_state(
        self,
        food_text="500",
        food_confidence=90,
        population_text="3/12",
    ):
        fake_results = [
            {"text": food_text, "confidence": food_confidence},
            {"text": "100", "confidence": 90},
            {"text": "0", "confidence": 90},
            {"text": "0", "confidence": 90},
            {"text": population_text, "confidence": 90},
        ]
        with patch.object(
            self.perception,
            "read_text",
            side_effect=fake_results,
        ):
            return self.perception.observe(self.frame)

    def test_valid_numbers(self):
        state = self.read_state()
        self.assertEqual(state["food"], 500)
        self.assertEqual(state["wood"], 100)
        self.assertEqual(state["pop_used"], 3)
        self.assertEqual(state["pop_cap"], 12)

    def test_low_confidence_is_unknown(self):
        state = self.read_state(food_confidence=5)
        self.assertIsNone(state["food"])

    def test_invalid_food_is_unknown(self):
        state = self.read_state(food_text="5O0")
        self.assertIsNone(state["food"])

    def test_nonfinite_tesseract_confidence_is_unknown(self):
        with patch(
            "aoe1.perception.hud.pytesseract.image_to_data",
            return_value={"text": ["500"], "conf": ["nan"]},
        ):
            result = self.perception.read_text(crop(self.frame, [0, 0, 8, 8]))
        self.assertEqual(result["confidence"], -1.0)

    def test_missing_population_separator(self):
        state = self.read_state(population_text="312")
        self.assertIsNone(state["pop_used"])
        self.assertIsNone(state["pop_cap"])

    def test_population_above_capacity_is_rejected(self):
        state = self.read_state(population_text="14/12")
        self.assertIsNone(state["pop_used"])
        self.assertIsNone(state["pop_cap"])

    def test_identical_templates_match(self):
        scores = self.perception.ui_scores(self.frame)
        for score in scores.values():
            self.assertGreater(score, 0.99)

    def test_nonfinite_template_score_fails_closed(self):
        with patch(
            "aoe1.perception.hud.cv2.matchTemplate",
            return_value=np.array([[np.nan]], dtype=np.float32),
        ):
            scores = self.perception.ui_scores(self.frame)
        self.assertEqual(scores["tc_marker"], 0.0)
        self.assertEqual(scores["train_villager"], 0.0)

    def test_crop_outside_image_is_rejected(self):
        with self.assertRaises(ValueError):
            crop(self.frame, [63, 0, 8, 8])


def economy_state(food=500, population=3, capacity=12):
    return GameState(
        resources=Resources(food=food),
        population=Population(used=population, cap=capacity),
    )


class SkillEdgeTests(unittest.TestCase):
    def test_food_must_be_sufficient_in_both_observations(self):
        skill = TrainVillagerSkill(50)
        skill.decide(economy_state(food=25), 0)
        action, _ = skill.decide(economy_state(food=100), 1)
        self.assertEqual(action, "WAIT")
        action, _ = skill.decide(economy_state(food=100), 2)
        self.assertEqual(action, "TRAIN_VILLAGER")

    def test_population_drop_stops_after_stable_observation(self):
        skill = TrainVillagerSkill(50)
        skill.sent(3, 0)
        skill.decide(economy_state(population=2), 1)
        action, _ = skill.decide(economy_state(population=2), 2)
        self.assertEqual(action, "STOP")
        self.assertEqual(skill.confirmed, 0)

    def test_unexpected_population_jump_is_not_confirmed(self):
        skill = TrainVillagerSkill(50)
        skill.sent(3, 0)
        skill.decide(economy_state(population=5), 1)
        action, _ = skill.decide(economy_state(population=5), 2)
        self.assertEqual(action, "STOP")
        self.assertEqual(skill.confirmed, 0)


if __name__ == "__main__":
    unittest.main()
