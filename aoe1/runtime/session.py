"""Session directories — every run preserves the evidence it relied on."""

import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


@dataclass(frozen=True)
class SessionPaths:
    run_dir: Path

    @classmethod
    def create(cls, root: Path) -> "SessionPaths":
        run_dir = Path(root) / "runs" / datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        run_dir.mkdir(parents=True)

        # Preserve the exact configuration and templates used by this session.
        shutil.copy2(Path(root) / "config.json", run_dir / "config.json")
        session_assets = run_dir / "assets"
        session_assets.mkdir()
        for filename in ("tc_marker.png", "train_villager.png"):
            shutil.copy2(Path(root) / "assets" / filename, session_assets / filename)
        environment_snapshot = Path(root) / "requirements-lock.txt"
        if environment_snapshot.is_file():
            shutil.copy2(environment_snapshot, run_dir / "requirements-lock.txt")
        return cls(run_dir=run_dir)
