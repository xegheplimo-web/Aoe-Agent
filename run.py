"""Scenario-limited villager experiment. Dry run by default; F9 to stop."""

# Import before GUI libraries so DPI awareness is set first.
import argparse
import json
import math
from pathlib import Path

from aoe1.runtime import AgentRuntime

ROOT = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true", help="Cho phep gui input sau kiem chung.")
    parser.add_argument("--seconds", type=float, default=30, help="Gioi han thoi gian phien.")
    args = parser.parse_args()
    if not math.isfinite(args.seconds) or args.seconds <= 0:
        parser.error("--seconds phai la so huu han > 0")
    config = json.loads((ROOT / "config.json").read_text(encoding="utf-8-sig"))
    return AgentRuntime(config, ROOT, live=args.live).run(args.seconds)


if __name__ == "__main__":
    raise SystemExit(main())
