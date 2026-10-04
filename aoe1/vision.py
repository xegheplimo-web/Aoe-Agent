"""Conservative OCR and fixed-ROI UI checks for one calibrated scenario."""

import math
import re
from pathlib import Path

import cv2
import numpy as np
import pytesseract

RESOURCE_FIELDS = ("food", "wood", "gold", "stone")
UI_FIELDS = ("tc_marker", "train_villager")


def crop(frame, roi):
    if frame is None or not hasattr(frame, "shape") or len(frame.shape) < 2:
        raise ValueError("Anh dau vao khong hop le.")
    if len(roi) != 4:
        raise ValueError("ROI phai co [x, y, width, height].")
    x, y, width, height = roi
    if any(not isinstance(value, int) for value in roi):
        raise ValueError("ROI phai la so nguyen.")
    image_height, image_width = frame.shape[:2]
    if (
        x < 0 or y < 0 or width <= 0 or height <= 0
        or x + width > image_width or y + height > image_height
    ):
        raise ValueError("ROI nam ngoai anh.")
    return frame[y:y + height, x:x + width]


def save_png(path, image):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    # imencode supports Windows paths containing non-ASCII characters.
    success, encoded = cv2.imencode(".png", image)
    if not success:
        raise RuntimeError(f"Khong ma hoa duoc anh: {path}")
    path.write_bytes(encoded.tobytes())


class Perception:
    def __init__(self, config, profile):
        self.rois = config["rois"]
        self.min_confidence = float(config.get("ocr_min_confidence", 45))
        self.templates = {}
        for name in UI_FIELDS:
            path = Path(profile) / "assets" / f"{name}.png"
            template = cv2.imread(str(path), cv2.IMREAD_COLOR)
            if template is None:
                raise FileNotFoundError(f"Khong doc duoc anh mau: {path}")
            expected = self.rois[name]
            if template.shape[:2] != (expected[3], expected[2]):
                raise ValueError(f"Anh mau {name} khac kich thuoc ROI.")
            self.templates[name] = template

    def read_text(self, image):
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        upscaled = cv2.resize(
            gray, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC
        )
        # Keep text polarity: Tesseract handles the bright HUD after Otsu.
        _, processed = cv2.threshold(
            upscaled, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
        )
        data = pytesseract.image_to_data(
            processed,
            config="--psm 7 -c tessedit_char_whitelist=0123456789/",
            output_type=pytesseract.Output.DICT,
            timeout=2.0,
        )
        tokens = []
        confidences = []
        for text, confidence in zip(data["text"], data["conf"], strict=True):
            text = str(text).strip()
            if text:
                tokens.append(text)
                try:
                    parsed_confidence = float(confidence)
                    confidences.append(
                        parsed_confidence if math.isfinite(parsed_confidence) else -1.0
                    )
                except (TypeError, ValueError):
                    confidences.append(-1.0)
        return {
            "text": "".join(tokens),
            "confidence": min(confidences) if confidences else -1.0,
        }

    def observe(self, frame):
        raw = {}
        state = {}
        for name in (*RESOURCE_FIELDS, "population"):
            result = self.read_text(crop(frame, self.rois[name]))
            raw[name] = result
            text = result["text"].strip()
            confident = result["confidence"] >= self.min_confidence
            if name in RESOURCE_FIELDS:
                state[name] = int(text) if confident and re.fullmatch(r"\d+", text) else None
            else:
                match = re.fullmatch(r"(\d+)\s*/\s*(\d+)", text) if confident else None
                if match:
                    used, cap = int(match.group(1)), int(match.group(2))
                    if cap > 0 and used <= cap:
                        state["pop_used"], state["pop_cap"] = used, cap
                        continue
                state["pop_used"], state["pop_cap"] = None, None
        state["ocr_raw"] = raw
        return state

    def ui_scores(self, frame):
        scores = {}
        for name in UI_FIELDS:
            region = crop(frame, self.rois[name])
            template = self.templates[name]
            # Identical-size regions: no searching elsewhere in the screen.
            difference = cv2.matchTemplate(
                region, template, cv2.TM_SQDIFF_NORMED
            )
            value = float(difference[0, 0])
            scores[name] = (
                float(np.clip(1.0 - value, 0, 1))
                if math.isfinite(value) else 0.0
            )
        return scores
