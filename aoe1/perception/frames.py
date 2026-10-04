"""Frame utilities shared by capture, calibration and replay paths."""

from pathlib import Path

import cv2


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
        x < 0
        or y < 0
        or width <= 0
        or height <= 0
        or x + width > image_width
        or y + height > image_height
    ):
        raise ValueError("ROI nam ngoai anh.")
    return frame[y : y + height, x : x + width]


def save_png(path, image):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    # imencode supports Windows paths containing non-ASCII characters.
    success, encoded = cv2.imencode(".png", image)
    if not success:
        raise RuntimeError(f"Khong ma hoa duoc anh: {path}")
    path.write_bytes(encoded.tobytes())
