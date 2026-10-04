"""Guarded game window: client-area capture plus press/click primitives."""

import hashlib
from collections.abc import Sequence
from pathlib import Path

from aoe1.platform.safety import assert_no_held_input, require_windows


def _sha256(path: Path):
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for block in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


class GameWindow:
    """Capture a visible foreground client and issue only guarded single actions."""

    def __init__(self, exe_name: str, stop, expected_size: Sequence[int] | None = None):
        require_windows()
        import mss
        import psutil
        import win32gui
        import win32process

        self._win32gui = win32gui
        self.stop = stop
        self.expected_size = list(expected_size) if expected_size is not None else None
        self._capture = mss.mss()

        processes = []
        for process in psutil.process_iter(["name", "exe"]):
            try:
                if (process.info.get("name") or "").casefold() == exe_name.casefold():
                    processes.append(process)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue

        if not processes:
            self.close()
            raise RuntimeError(f"Khong tim thay tien trinh game: {exe_name}")

        pids = {process.pid for process in processes}
        windows = []

        def collect(hwnd, _):
            if not win32gui.IsWindowVisible(hwnd):
                return
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            if pid in pids and win32gui.GetClientRect(hwnd)[2:] != (0, 0):
                windows.append((hwnd, pid))

        win32gui.EnumWindows(collect, None)
        if not windows:
            self.close()
            raise RuntimeError("Khong tim thay cua so game dang hien thi.")

        foreground = win32gui.GetForegroundWindow()
        self.hwnd, pid = next(
            ((hwnd, pid) for hwnd, pid in windows if hwnd == foreground),
            windows[0],
        )
        self.process = next(process for process in processes if process.pid == pid)

    def box(self):
        if self.stop.is_set():
            raise RuntimeError("Dung theo yeu cau F9.")
        gui = self._win32gui
        if not gui.IsWindow(self.hwnd) or not gui.IsWindowVisible(self.hwnd):
            raise RuntimeError("Cua so game da dong hoac bi an.")
        if gui.GetForegroundWindow() != self.hwnd:
            raise RuntimeError("Game khong con focus. Khong gui input.")

        left, top, right, bottom = gui.GetClientRect(self.hwnd)
        x, y = gui.ClientToScreen(self.hwnd, (left, top))
        width, height = right - left, bottom - top
        if width <= 0 or height <= 0:
            raise RuntimeError("Kich thuoc vung client khong hop le.")
        if self.expected_size is not None and [width, height] != self.expected_size:
            raise RuntimeError(
                f"Kich thuoc game da doi: {width}x{height}, profile: {self.expected_size}."
            )
        return x, y, width, height

    def capture(self):
        import cv2
        import numpy as np

        left, top, width, height = self.box()
        shot = self._capture.grab({"left": left, "top": top, "width": width, "height": height})
        return cv2.cvtColor(np.asarray(shot), cv2.COLOR_BGRA2BGR)

    def fingerprint(self):
        executable = Path(self.process.exe()).resolve()
        # DAT location varies between installations; missing DAT is explicit.
        candidates = [
            executable.parent / "data" / "empires.dat",
            executable.parent / "DATA" / "empires.dat",
            executable.parent / "empires.dat",
        ]
        dat_path = next((path for path in candidates if path.is_file()), None)
        return {
            "exe_sha256": _sha256(executable),
            "dat_sha256": _sha256(dat_path) if dat_path is not None else None,
        }

    def press(self, key):
        import pyautogui as pg

        self.box()
        if key not in pg.KEYBOARD_KEYS:
            raise ValueError(f"Phim khong hop le: {key}")
        assert_no_held_input()
        pg.press(key)

    def click(self, x, y):
        import pyautogui as pg

        left, top, width, height = self.box()
        if not (0 <= x < width and 0 <= y < height):
            raise ValueError("Toa do click nam ngoai game.")
        assert_no_held_input()
        pg.click(left + int(x), top + int(y))

    def close(self):
        if getattr(self, "_capture", None) is not None:
            self._capture.close()
            self._capture = None
