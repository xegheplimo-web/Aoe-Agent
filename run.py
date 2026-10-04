"""Scenario-limited villager experiment. Dry run by default; F9 to stop."""

# Import before GUI libraries so DPI awareness is set first.
import argparse
import json
import math
import shutil
import time
from datetime import datetime
from pathlib import Path

import pytesseract

from aoe1.desktop import GameWindow, start_stop_key
from aoe1.policy import EconomyPolicy
from aoe1.vision import Perception, save_png

ROOT = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true", help="Cho phep gui input sau kiem chung.")
    parser.add_argument("--seconds", type=float, default=30, help="Gioi han thoi gian phien.")
    args = parser.parse_args()
    if not math.isfinite(args.seconds) or args.seconds <= 0:
        parser.error("--seconds phai la so huu han > 0")

    config = json.loads((ROOT / "config.json").read_text(encoding="utf-8-sig"))
    if not math.isfinite(float(config["tick_seconds"])) or config["tick_seconds"] < 0:
        raise ValueError("tick_seconds khong hop le.")
    threshold = float(config["template_threshold"])
    if not math.isfinite(threshold) or not 0 < threshold <= 1:
        raise ValueError("template_threshold phai nam trong (0, 1].")
    pytesseract.pytesseract.tesseract_cmd = config["tesseract_cmd"]

    run_dir = ROOT / "runs" / datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    run_dir.mkdir(parents=True)

    # Preserve the exact configuration and templates used by this session.
    shutil.copy2(ROOT / "config.json", run_dir / "config.json")
    session_assets = run_dir / "assets"
    session_assets.mkdir()
    for filename in ("tc_marker.png", "train_villager.png"):
        shutil.copy2(ROOT / "assets" / filename, session_assets / filename)
    environment_snapshot = ROOT / "requirements-lock.txt"
    if environment_snapshot.is_file():
        shutil.copy2(environment_snapshot, run_dir / "requirements-lock.txt")

    stop = None
    game = None
    reason = "Chua bat dau."
    exit_code = 0

    def log(file, event):
        file.write(json.dumps(event, ensure_ascii=False) + "\n")
        file.flush()

    try:
        perception = Perception(config, run_dir)
        policy = EconomyPolicy(
            config["villager_cost"],
            config["target_villagers"],
            config["confirmation_timeout_seconds"],
        )
        if args.live:
            import pyautogui as pg
            pg.FAILSAFE = True

        stop = start_stop_key()
        game = GameWindow(
            config["exe_name"], stop, expected_size=config["client_size"]
        )
        if game.fingerprint() != config["fingerprint"]:
            raise RuntimeError("EXE/DAT khac luc calibration; khong gui input.")
        print(
            ("LIVE" if args.live else "DRY RUN")
            + ": Trong 5 giay chuyen sang game va chon nha chinh. F9 de dung."
        )
        if stop.wait(5):
            raise RuntimeError("Dung theo yeu cau F9.")

        started = time.monotonic()
        with (run_dir / "events.jsonl").open("w", encoding="utf-8") as events:
            index = 0
            while True:
                elapsed = time.monotonic() - started
                if stop.is_set():
                    reason = "Dung theo yeu cau F9."
                    break
                if elapsed >= args.seconds:
                    reason = "Da het gioi han thoi gian phien."
                    break

                frame = game.capture()
                image_name = f"{index:05d}.png"
                save_png(run_dir / image_name, frame)
                state = perception.observe(frame)
                action, decision_reason = policy.decide(state, elapsed)
                log(events, {
                    "type": "observation",
                    "elapsed": elapsed,
                    "image": image_name,
                    "state": state,
                    "action": action,
                    "reason": decision_reason,
                    "confirmed": policy.confirmed,
                    "live": args.live,
                })
                print(
                    f"[{index:05d}] {action} | food={state['food']} "
                    f"pop={state['pop_used']}/{state['pop_cap']} | {decision_reason}"
                )

                if action == "STOP":
                    reason = decision_reason
                    break

                if action == "TRAIN_VILLAGER" and args.live:
                    if stop.is_set():
                        reason = "Dung theo yeu cau F9."
                        break
                    game.press(config["town_center_hotkey"])
                    if stop.wait(0.25):
                        reason = "Dung theo yeu cau F9."
                        break
                    selected = game.capture()
                    save_png(run_dir / f"selection_{index:05d}.png", selected)
                    scores = perception.ui_scores(selected)
                    if not scores or any(
                        not math.isfinite(score) or score < threshold
                        for score in scores.values()
                    ):
                        log(events, {
                            "type": "action_blocked",
                            "elapsed": time.monotonic() - started,
                            "action": "TRAIN_VILLAGER",
                            "reason": "Giao dien khong khop anh mau.",
                            "ui_scores": scores,
                            "threshold": threshold,
                        })
                        reason = "Giao dien khong khop anh mau; khong bam xin dan."
                        break

                    x, y, width, height = config["rois"]["train_villager"]
                    game.click(x + width // 2, y + height // 2)
                    policy.sent(state["pop_used"], time.monotonic() - started)
                    log(events, {
                        "type": "action_issued",
                        "elapsed": time.monotonic() - started,
                        "action": "TRAIN_VILLAGER",
                        "ui_scores": scores,
                        "image": f"selection_{index:05d}.png",
                    })
                index += 1
                if stop.wait(config["tick_seconds"]):
                    reason = "Dung theo yeu cau F9."
                    break
    except (Exception, KeyboardInterrupt) as error:
        reason = f"{type(error).__name__}: {error}"
        exit_code = 1
        print("ERROR:", reason)
    finally:
        if stop is not None:
            stop.set()
        if game is not None:
            game.close()
        (run_dir / "exit.txt").write_text(reason + "\n", encoding="utf-8")
        print("Phien:", run_dir)
        print("Ly do dung:", reason)
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
