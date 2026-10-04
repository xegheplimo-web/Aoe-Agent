import unittest

from aoe1.policy import EconomyPolicy


def state(food=500, pop=3, cap=12):
    return {"food": food, "pop_used": pop, "pop_cap": cap}


class EconomyPolicyTests(unittest.TestCase):
    def test_two_observations_required(self):
        policy = EconomyPolicy(50)
        self.assertEqual(policy.decide(state(), 0)[0], "WAIT")
        self.assertEqual(policy.decide(state(), 1)[0], "TRAIN_VILLAGER")

    def test_unknown_ocr_never_issues(self):
        policy = EconomyPolicy(50)
        self.assertEqual(policy.decide(state(food=None), 0)[0], "WAIT")
        self.assertEqual(policy.decide(state(food=None), 1)[0], "WAIT")

    def test_full_population_stops(self):
        policy = EconomyPolicy(50)
        self.assertEqual(policy.decide(state(pop=12), 0)[0], "STOP")

    def test_full_population_stops_even_if_food_ocr_is_unknown(self):
        policy = EconomyPolicy(50)
        self.assertEqual(policy.decide(state(food=None, pop=12), 0)[0], "STOP")

    def test_pending_command_is_not_reissued(self):
        policy = EconomyPolicy(50)
        policy.decide(state(), 0)
        policy.decide(state(), 1)
        policy.sent(3, 1)
        self.assertEqual(policy.decide(state(), 2)[0], "WAIT")
        self.assertEqual(policy.decide(state(), 3)[0], "WAIT")
        self.assertEqual(policy.decide(state(), 91)[0], "STOP")
        self.assertEqual(policy.confirmed, 0)

    def test_stable_plus_one_is_confirmed(self):
        policy = EconomyPolicy(50, target_villagers=1)
        policy.sent(3, 0)
        self.assertEqual(policy.decide(state(pop=4), 1)[0], "WAIT")
        self.assertEqual(policy.decide(state(pop=4), 2)[0], "STOP")
        self.assertEqual(policy.confirmed, 1)

    def test_no_duplicate_send_while_pending(self):
        policy = EconomyPolicy(50)
        policy.sent(3, 0)
        with self.assertRaises(RuntimeError):
            policy.sent(3, 1)


if __name__ == "__main__":
    unittest.main()
