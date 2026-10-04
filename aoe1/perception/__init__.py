"""Perception layer — frames in, observations out. No game knowledge lives here."""

from aoe1.perception.frames import crop, save_png
from aoe1.perception.hud import RESOURCE_FIELDS, UI_FIELDS, Perception

__all__ = [
    "RESOURCE_FIELDS",
    "UI_FIELDS",
    "Perception",
    "crop",
    "save_png",
]
