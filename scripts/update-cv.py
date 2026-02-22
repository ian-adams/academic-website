"""
Auto-update CV PDF in the website repo from local Google Drive source.
Copies the file, commits, and pushes only if the PDF has actually changed.

Run manually:   python scripts/update-cv.py
Schedule via:   Windows Task Scheduler (see repo README or CLAUDE.md)
"""

import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CV_SOURCE = Path(r"G:\Other computers\My Computer\R\CV-stuff\(new) CV Academic and Website\cv.pdf")
CV_DEST = REPO_ROOT / "public" / "media" / "cv.pdf"


def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, cwd=REPO_ROOT, capture_output=True, text=True, **kwargs)


def main():
    if not CV_SOURCE.exists():
        print(f"ERROR: CV source not found: {CV_SOURCE}")
        print("Is Google Drive mounted?")
        sys.exit(1)

    # Copy the file
    shutil.copy2(CV_SOURCE, CV_DEST)
    print(f"Copied {CV_SOURCE.name} -> {CV_DEST.relative_to(REPO_ROOT)}")

    # Check if anything actually changed
    result = run(["git", "diff", "--quiet", "--", str(CV_DEST.relative_to(REPO_ROOT))])
    if result.returncode == 0:
        print("CV unchanged — nothing to commit.")
        return

    # Stage, commit, push
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    run(["git", "add", str(CV_DEST.relative_to(REPO_ROOT))])
    commit_msg = f"Update CV PDF ({timestamp})"
    result = run(["git", "commit", "-m", commit_msg])
    if result.returncode != 0:
        print(f"Commit failed:\n{result.stderr}")
        sys.exit(1)
    print(f"Committed: {commit_msg}")

    result = run(["git", "push"])
    if result.returncode != 0:
        print(f"Push failed:\n{result.stderr}")
        sys.exit(1)
    print("Pushed to origin.")


if __name__ == "__main__":
    main()
