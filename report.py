"""Offline JSONL run summary. Never captures a screen or sends input."""

import argparse
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STATE_FIELDS = ("food", "wood", "gold", "stone", "pop_used", "pop_cap")


def find_latest_run():
    parent = ROOT / "runs"
    if not parent.is_dir():
        raise RuntimeError("Chua co thu muc runs/.")
    candidates = sorted(
        directory for directory in parent.iterdir()
        if directory.is_dir() and (directory / "config.json").is_file()
    )
    if not candidates:
        raise RuntimeError("Chua tim thay phien chay.")
    return candidates[-1]


def read_events(path):
    events = []
    invalid_lines = []
    if not path.is_file():
        return events, invalid_lines
    with path.open("r", encoding="utf-8-sig") as file:
        for line_number, line in enumerate(file, start=1):
            if not line.strip():
                continue
            try:
                event = json.loads(line)
                if not isinstance(event, dict):
                    raise ValueError("Event khong phai object.")
                events.append(event)
            except (json.JSONDecodeError, ValueError):
                invalid_lines.append(line_number)
    return events, invalid_lines


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "run_directory", nargs="?", type=Path,
        help="Bo trong de doc phien gan nhat.",
    )
    args = parser.parse_args()
    run_dir = args.run_directory.resolve() if args.run_directory else find_latest_run()
    if not run_dir.is_dir():
        raise RuntimeError(f"Khong co thu muc: {run_dir}")
    event_path = run_dir / "events.jsonl"
    events, invalid_lines = read_events(event_path)
    observations = [event for event in events if event.get("type") == "observation"]
    issued = [event for event in events if event.get("type") == "action_issued"]
    unknown_counts = {
        field: sum(
            observation.get("state", {}).get(field) is None
            for observation in observations
        )
        for field in STATE_FIELDS
    }
    times = [
        float(observation["elapsed"])
        for observation in observations
        if "elapsed" in observation
    ]
    intervals = [
        newer - older for older, newer in zip(times, times[1:], strict=False)
        if newer >= older
    ]
    last = observations[-1] if observations else {}
    exit_path = run_dir / "exit.txt"
    exit_reason = (
        exit_path.read_text(encoding="utf-8").strip()
        if exit_path.is_file() else "Chua co exit.txt."
    )
    summary = {
        "run_directory": str(run_dir),
        "events_file_present": event_path.is_file(),
        "event_count": len(events),
        "corrupt_jsonl_lines": invalid_lines,
        "observation_count": len(observations),
        "live": last.get("live"),
        "decisions": dict(Counter(
            observation.get("action", "UNKNOWN") for observation in observations
        )),
        "commands_issued": dict(Counter(
            event.get("action", "UNKNOWN") for event in issued
        )),
        "confirmed_by_policy": max(
            (int(observation.get("confirmed", 0)) for observation in observations),
            default=0,
        ),
        "unknown_ocr_counts": unknown_counts,
        "mean_observation_interval_seconds": (
            sum(intervals) / len(intervals) if intervals else None
        ),
        "last_state": {
            field: last.get("state", {}).get(field) for field in STATE_FIELDS
        },
        "last_decision": last.get("action"),
        "last_decision_reason": last.get("reason"),
        "exit_reason": exit_reason,
    }
    text = json.dumps(summary, indent=2, ensure_ascii=False)
    print(text)
    (run_dir / "summary.json").write_text(text, encoding="utf-8")


if __name__ == "__main__":
    main()
