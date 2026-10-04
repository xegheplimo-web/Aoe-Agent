"""Windows-only safety gates shared by capture and input paths.

Importing this module sets process DPI awareness, so it must be imported
before GUI libraries (pyautogui, cv2 GUI calls).
"""

import contextlib
import ctypes
import sys
import threading

if sys.platform == "win32":
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2)
    except (AttributeError, OSError):
        with contextlib.suppress(AttributeError, OSError):
            ctypes.windll.user32.SetProcessDPIAware()


def require_windows():
    if sys.platform != "win32":
        raise RuntimeError("Capture va input truc tiep chi hoat dong tren Windows.")


def start_stop_key():
    """Return an Event set when F9 is held; the watcher never sends input."""
    require_windows()
    import win32api

    stop = threading.Event()

    def watch():
        while not stop.wait(0.05):
            if win32api.GetAsyncKeyState(0x78) & 0x8000:  # VK_F9
                stop.set()
                break

    threading.Thread(target=watch, name="aoe1-f9-stop", daemon=True).start()
    return stop


_WATCHED_KEYS = {
    "left_mouse": 0x01,
    "right_mouse": 0x02,
    "middle_mouse": 0x04,
    "shift": 0x10,
    "ctrl": 0x11,
    "alt": 0x12,
    "left_windows": 0x5B,
    "right_windows": 0x5C,
}


def assert_no_held_input():
    """Refuse to act while the human is holding a modifier or mouse button."""
    require_windows()
    import win32api

    held = [
        name
        for name, key_code in _WATCHED_KEYS.items()
        if win32api.GetAsyncKeyState(key_code) & 0x8000
    ]
    if held:
        raise RuntimeError(
            "Dang giu phim/nut chuot: " + ", ".join(held) + ". Dung de tranh thao tac nham."
        )
