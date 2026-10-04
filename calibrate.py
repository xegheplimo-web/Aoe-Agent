"""Interactively calibrate one fixed AoE1 window and controlled scenario."""

# Import before GUI libraries so Windows DPI awareness is set first.
import json
from pathlib import Path

import cv2
import pytesseract

from aoe1.perception import crop, save_png
from aoe1.platform import GameWindow, start_stop_key

ROOT = Path(__file__).resolve().parent
FIELDS = (
    ("food", "So thuc (chi chu so)"),
    ("wood", "So go (chi chu so)"),
    ("gold", "So vang (chi chu so)"),
    ("stone", "So da (chi chu so)"),
    ("population", "Dan so, ca dau / va hai so"),
    ("tc_marker", "Chi tiet rieng cua nha chinh, khong doi"),
    ("train_villager", "Nut xin dan dang KHA DUNG, khong hover"),
)


def ask_int(label, default, minimum=1):
    text = input(f"{label} [{default}]: ").strip()
    value = int(text) if text else default
    if value < minimum:
        raise ValueError(f"{label} phai >= {minimum}.")
    return value


def main():
    print("CALIBRATION v0.1: chon nha chinh, nut xin dan kha dung.")
    print("Khong dung profile nay sau khi doi do phan giai/UI scaling.")
    exe_name = input("Ten EXE game [Empiresx.exe]: ").strip() or "Empiresx.exe"
    tesseract_cmd = (
        input(r"Duong dan Tesseract [C:\Program Files\Tesseract-OCR\tesseract.exe]: ").strip()
        or r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    )
    pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
    tesseract_version = str(pytesseract.get_tesseract_version())
    if "eng" not in pytesseract.get_languages(config=""):
        raise RuntimeError("Tesseract chua co du lieu ngon ngu eng.")

    civilization = input("Civilization dung trong scenario: ").strip()
    if not civilization:
        raise ValueError("Can ghi civilization de tai lap scenario.")
    cost = ask_int("Gia xin dan dang hien thi (thuc)", 50)
    scale = input("Windows display scaling (vd 100%): ").strip()
    wrapper = input("Wrapper do hoa (Enter neu khong co): ").strip() or "none"
    hotkey = input("Phim chon nha chinh [h]: ").strip().lower() or "h"
    if len(hotkey) != 1:
        raise ValueError("Chi dung mot phim don de chon nha chinh.")
    target = ask_int("So dan muon xac nhan", 3)

    stop = start_stop_key()
    game = None
    try:
        game = GameWindow(exe_name, stop)
        print("Trong 5 giay, chuyen sang game va CHON NHA CHINH. F9 de dung.")
        if stop.wait(5):
            raise RuntimeError("Dung theo yeu cau F9.")
        frame = game.capture()
        height, width = frame.shape[:2]
        fingerprint = game.fingerprint()
        rois = {}
        for name, label in FIELDS:
            print(f"Chon {name}: {label}. Enter de xac nhan; Esc de huy.")
            selected = cv2.selectROI(f"ROI: {name}", frame, False, False)
            cv2.destroyAllWindows()
            roi = [int(value) for value in selected]
            if roi[2] < 3 or roi[3] < 3:
                raise RuntimeError(f"ROI {name} qua nho hoac da huy.")
            crop(frame, roi)  # Refuse out-of-frame selections.
            rois[name] = roi

        assets = ROOT / "assets"
        assets.mkdir(exist_ok=True)
        save_png(assets / "calibration.png", frame)
        for name in ("tc_marker", "train_villager"):
            save_png(assets / f"{name}.png", crop(frame, rois[name]))

        config = {
            "version": "0.1",
            "exe_name": exe_name,
            "client_size": [width, height],
            "fingerprint": fingerprint,
            "tesseract_cmd": tesseract_cmd,
            "rois": rois,
            "ocr_min_confidence": 45,
            "template_threshold": 0.97,
            "villager_cost": cost,
            "target_villagers": target,
            "town_center_hotkey": hotkey,
            "confirmation_timeout_seconds": 90,
            "tick_seconds": 1.0,
            "environment": {
                "tesseract_version": tesseract_version,
                "civilization": civilization,
                "display_scaling": scale or "not recorded",
                "wrapper": wrapper,
                "villager_cost_visible": cost,
            },
        }
        (ROOT / "config.json").write_text(
            json.dumps(config, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        print("Da luu config.json va assets/. Chay diagnose.py truoc live.")
    finally:
        cv2.destroyAllWindows()
        stop.set()
        if game is not None:
            game.close()


if __name__ == "__main__":
    main()
