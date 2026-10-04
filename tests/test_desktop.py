import sys
import types
import unittest
from unittest.mock import patch

from aoe1.desktop import GameWindow


class HeldInputTests(unittest.TestCase):
    def test_held_shift_blocks_input(self):
        fake_api = types.SimpleNamespace(
            GetAsyncKeyState=lambda code: 0x8000 if code == 0x10 else 0,
        )
        with patch.object(sys, "platform", "win32"), patch.dict(
            sys.modules, {"win32api": fake_api},
        ), self.assertRaisesRegex(RuntimeError, "shift"):
            GameWindow._assert_no_held_input()

    def test_held_mouse_blocks_input(self):
        fake_api = types.SimpleNamespace(
            GetAsyncKeyState=lambda code: 0x8000 if code == 0x01 else 0,
        )
        with patch.object(sys, "platform", "win32"), patch.dict(
            sys.modules, {"win32api": fake_api},
        ), self.assertRaisesRegex(RuntimeError, "left_mouse"):
            GameWindow._assert_no_held_input()

    def test_released_keys_allow_check(self):
        fake_api = types.SimpleNamespace(GetAsyncKeyState=lambda code: 0)
        with patch.object(sys, "platform", "win32"), patch.dict(
            sys.modules, {"win32api": fake_api},
        ):
            GameWindow._assert_no_held_input()

    def test_click_refuses_out_of_client_coordinates(self):
        fake_pg = types.SimpleNamespace(click=lambda *args: None)
        window = object.__new__(GameWindow)
        with patch.dict(sys.modules, {"pyautogui": fake_pg}), patch.object(
            window, "box", return_value=(100, 200, 640, 480),
        ), self.assertRaisesRegex(ValueError, "ngoai game"):
            window.click(640, 20)


if __name__ == "__main__":
    unittest.main()
