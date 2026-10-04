"""World model — typed game state handed to planners and skills.

Planner-facing seam: skills read `GameState`, never raw pixels.
"""

from aoe1.world.state import GameState, Population, Resources

__all__ = ["GameState", "Population", "Resources"]
