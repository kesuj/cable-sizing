"""Copy ONLY the website files into the public site repo (../cable-sizing-app), then commit + push.

The private repo keeps the original Excel file, research notes and scripts; the public repo gets
just what the browser needs. Usage:  python scripts/publish_site.py
"""
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT.parent / "cable-sizing-app"
FILES = ["index.html", "guide.html", "styles.css", "dist/app.bundle.js"]

subprocess.run([sys.executable, str(ROOT / "scripts" / "build.py")], check=True)
if not (SITE / ".git").exists():
    sys.exit(f"{SITE} is not a git checkout of the public site repo.")
for f in FILES:
    (SITE / f).parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / f, SITE / f)
(SITE / ".nojekyll").touch()
readme = SITE / "README.md"
if not readme.exists():
    readme.write_text(
        "# Conductor sizing — live site\n\n"
        "Open **https://kesuj.github.io/cable-sizing-app/** — LV and HV cable sizing, Nepal (IS) and IEC 60364.\n\n"
        "This repo only holds the published website. It is generated; do not edit it by hand.\n",
        encoding="utf-8")
git = lambda *a: subprocess.run(["git", "-C", str(SITE), *a], check=True, capture_output=True, text=True).stdout
git("add", "-A")
if git("status", "--porcelain").strip():
    msg = "Publish site from cable-sizing " + subprocess.run(
        ["git", "-C", str(ROOT), "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip()
    git("commit", "-m", msg)
    git("push", "origin", "HEAD:main")
    print("published:", msg)
else:
    print("site already up to date")
