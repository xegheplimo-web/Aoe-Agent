"""Windows platform layer — capture, input and safety gates.

Import this package (directly or transitively) before GUI libraries so that
DPI awareness is set first.
"""

from aoe1.platform.safety import assert_no_held_input, require_windows, start_stop_key
from aoe1.platform.window import GameWindow

__all__ = [
    "GameWindow",
    "assert_no_held_input",
    "require_windows",
    "start_stop_key",
]
