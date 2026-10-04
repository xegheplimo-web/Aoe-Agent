"""Append-only session recorder.

One `EventRecorder` owns `events.jsonl` and frame artifacts for a single run
directory. The schema is the dashboard/report contract — event field names
must stay stable (see report.py).
"""

import json
from pathlib import Path

from aoe1.perception.frames import save_png


class EventRecorder:
    def __init__(self, run_dir):
        self.run_dir = Path(run_dir)
        self._file = (self.run_dir / "events.jsonl").open("w", encoding="utf-8")

    def record(self, event_type, **fields):
        self._file.write(json.dumps({"type": event_type, **fields}, ensure_ascii=False) + "\n")
        self._file.flush()

    def save_frame(self, name, image):
        save_png(self.run_dir / name, image)

    def close(self):
        if not self._file.closed:
            self._file.close()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()
