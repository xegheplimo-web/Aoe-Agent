"""Read-only live/offline capture, OCR and UI-template inspection."""

# Import before GUI libraries to establish DPI awareness on Windows.
import argparse
import json
import math
import sys
import time
from datetime import datetime
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path

import cv2
import pytesseract

from aoe1.desktop import GameWindow, start_stop_key
from aoe1.vision import Perception, crop, save_png

ROOT = Path(__file__).resolve().parent
PACKAGES = (
    "numpy", "opencv-python", "mss", "PyAutoGUI",
    "pytesseract", "psutil", "pywin32",
)


def save_sample_images(directory, frame, rois):
    directory.mkdir(parents=True)
    save_png(directory / "frame.png", frame)
    annotated = frame.copy()
    for name, roi in rois.items():
        image = crop(frame, roi)
        save_png(directory / f"{name}.png", image)
        x, y, width, height = map(int, roi)
        cv2.rectangle(
            annotated, (x, y), (x + width - 1, y + height - 1), (0, 255, 0), 1
        )
        cv2.putText(
            annotated, name, (x, max(14, y - 4)),
            cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 255), 1, cv2.LINE_AA,
        )
    save_png(directory / "annotated.png", annotated)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--profile", type=Path, default=ROOT,
        help="Thu muc chua config.json va assets/.",
    )
    parser.add_argument(
        "--image", type=Path,
        help="Phan tich anh da luu thay vi chup game.",
    )
    parser.add_argument(
        "--count", type=int, default=3,
        help="So anh chup truc tiep. Bi bo qua khi dung --image.",
    )
    parser.add_argument(
        "--interval", type=float, default=1.0,
        help="Thoi gian nghi giua hai lan phan tich.",
    )
    args = parser.parse_args()
    if args.count < 1:
        parser.error("--count phai >= 1")
    if not math.isfinite(args.interval) or args.interval < 0:
        parser.error("--interval phai la so huu han >= 0")

    profile = args.profile.resolve()
    output = ROOT / "diagnostics" / datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    output.mkdir(parents=True)
    result = {
        "status": "started",
        "profile": str(profile),
        "source": str(args.image) if args.image else "live",
        "python": sys.version,
        "samples": [],
    }
    game = None
    stop = None
    exit_code = 0
    try:
        packages = {}
        for name in PACKAGES:
            try:
                packages[name] = version(name)
            except PackageNotFoundError:
                packages[name] = None
        result["packages"] = packages
        config = json.loads(
            (profile / "config.json").read_text(encoding="utf-8-sig")
        )
        result["config"] = config
        pytesseract.pytesseract.tesseract_cmd = config["tesseract_cmd"]
        result["tesseract"] = str(pytesseract.get_tesseract_version())
        languages = pytesseract.get_languages(config="")
        result["languages"] = languages
        if "eng" not in languages:
            raise RuntimeError("Tesseract chua co du lieu ngon ngu eng.")
        perception = Perception(config, profile)
        if args.image is None:
            stop = start_stop_key()
            game = GameWindow(
                config["exe_name"], stop, expected_size=config["client_size"]
            )
            actual_fingerprint = game.fingerprint()
            result["actual_fingerprint"] = actual_fingerprint
            if actual_fingerprint != config["fingerprint"]:
                raise RuntimeError("EXE/DAT khac luc calibration.")
            print(
                "KHONG GUI INPUT. Trong 5 giay, chuyen sang game "
                "va chon nha chinh. F9 de dung."
            )
            if stop.wait(5):
                raise RuntimeError("Dung theo yeu cau F9.")

        count = 1 if args.image else args.count
        for index in range(count):
            frame = (
                cv2.imread(str(args.image.resolve()))
                if args.image is not None else game.capture()
            )
            if frame is None:
                raise RuntimeError("Khong doc duoc anh.")
            height, width = frame.shape[:2]
            if [width, height] != config["client_size"]:
                raise RuntimeError(
                    "Kich thuoc anh khac profile calibration: "
                    f"{width}x{height}"
                )
            sample_dir = output / f"sample_{index:03d}"
            # Keep images even if the following OCR call fails.
            save_sample_images(sample_dir, frame, config["rois"])
            started = time.perf_counter()
            state = perception.observe(frame)
            ocr_seconds = time.perf_counter() - started
            scores = perception.ui_scores(frame)
            sample = {
                "index": index,
                "directory": sample_dir.name,
                "ocr_seconds": ocr_seconds,
                "frame_std": float(frame.std()),
                "state": state,
                "ui_scores": scores,
                "ui_matches_threshold": (
                    min(scores.values()) >= config["template_threshold"]
                ),
            }
            result["samples"].append(sample)
            print(
                f"[{index}] food={state['food']} wood={state['wood']} "
                f"gold={state['gold']} stone={state['stone']} "
                f"pop={state['pop_used']}/{state['pop_cap']} "
                f"ocr_seconds={ocr_seconds:.3f} ui={scores}"
            )
            if stop is not None and index + 1 < count and stop.wait(args.interval):
                raise RuntimeError("Dung theo yeu cau F9.")
        result["status"] = "analysis_finished"
    except (Exception, KeyboardInterrupt) as error:
        exit_code = 1
        result["status"] = "error"
        result["error"] = f"{type(error).__name__}: {error}"
        print("ERROR:", result["error"])
    finally:
        if stop is not None:
            stop.set()
        if game is not None:
            game.close()
        (output / "report.json").write_text(
            json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        print("Ket qua:", output)
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
