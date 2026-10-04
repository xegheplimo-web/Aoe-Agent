import unittest

from aoe1.skills import TrainVillagerSkill
from aoe1.world import GameState, Population, Resources


def state(food=500, pop=3, cap=12):
    return GameState(
        resources=Resources(food=food),
        population=Population(used=pop, cap=cap),
    )


class TrainVillagerDecisionTests(unittest.TestCase):
    def test_two_observations_required(self):
        skill = TrainVillagerSkill(50)
        self.assertEqual(skill.decide(state(), 0)[0], "WAIT")
        self.assertEqual(skill.decide(state(), 1)[0], "TRAIN_VILLAGER")

    def test_unknown_ocr_never_issues(self):
        skill = TrainVillagerSkill(50)
        self.assertEqual(skill.decide(state(food=None), 0)[0], "WAIT")
        self.assertEqual(skill.decide(state(food=None), 1)[0], "WAIT")

    def test_full_population_stops(self):
        skill = TrainVillagerSkill(50)
        self.assertEqual(skill.decide(state(pop=12), 0)[0], "STOP")

    def test_full_population_stops_even_if_food_ocr_is_unknown(self):
        skill = TrainVillagerSkill(50)
        self.assertEqual(skill.decide(state(food=None, pop=12), 0)[0], "STOP")

    def test_pending_command_is_not_reissued(self):
        skill = TrainVillagerSkill(50)
        skill.decide(state(), 0)
        skill.decide(state(), 1)
        skill.sent(3, 1)
        self.assertEqual(skill.decide(state(), 2)[0], "WAIT")
        self.assertEqual(skill.decide(state(), 3)[0], "WAIT")
        self.assertEqual(skill.decide(state(), 91)[0], "STOP")
        self.assertEqual(skill.confirmed, 0)

    def test_stable_plus_one_is_confirmed(self):
        skill = TrainVillagerSkill(50, target_villagers=1)
        skill.sent(3, 0)
        self.assertEqual(skill.decide(state(pop=4), 1)[0], "WAIT")
        self.assertEqual(skill.decide(state(pop=4), 2)[0], "STOP")
        self.assertEqual(skill.confirmed, 1)

    def test_no_duplicate_send_while_pending(self):
        skill = TrainVillagerSkill(50)
        skill.sent(3, 0)
        with self.assertRaises(RuntimeError):
            skill.sent(3, 1)


if __name__ == "__main__":
    unittest.main()
