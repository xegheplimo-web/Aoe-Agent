import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

import report


class ReportTests(unittest.TestCase):
    def test_invalid_jsonl_line_is_listed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "events.jsonl"
            path.write_text('{"type":"observation"}\ninvalid\n', encoding="utf-8")
            events, invalid = report.read_events(path)
            self.assertEqual(len(events), 1)
            self.assertEqual(invalid, [2])

    def test_dry_run_summary_has_no_issued_commands(self):
        with tempfile.TemporaryDirectory() as directory:
            run = Path(directory)
            event = {
                "type": "observation",
                "elapsed": 1,
                "live": False,
                "action": "TRAIN_VILLAGER",
                "confirmed": 0,
                "state": {
                    "food": 500,
                    "wood": 100,
                    "gold": 0,
                    "stone": 0,
                    "pop_used": 3,
                    "pop_cap": 12,
                },
            }
            (run / "events.jsonl").write_text(
                json.dumps(event) + "\n",
                encoding="utf-8",
            )
            (run / "exit.txt").write_text("Dry run finished\n", encoding="utf-8")
            with patch.object(sys, "argv", ["report.py", str(run)]), redirect_stdout(io.StringIO()):
                report.main()
            summary = json.loads((run / "summary.json").read_text(encoding="utf-8"))
            self.assertEqual(summary["decisions"]["TRAIN_VILLAGER"], 1)
            self.assertEqual(summary["commands_issued"], {})
            self.assertEqual(summary["confirmed_by_policy"], 0)
            self.assertEqual(summary["exit_reason"], "Dry run finished")


if __name__ == "__main__":
    unittest.main()
