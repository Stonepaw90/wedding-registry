"""Regenerate gifts-data.js from gifts.json.

The generated file lets the demo work when index.html is opened directly
(file:// pages cannot fetch local JSON). Run this after editing gifts.json.
"""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent.parent
GIFTS = ROOT / "gifts.json"
OUT = ROOT / "gifts-data.js"

data = json.loads(GIFTS.read_text(encoding="utf-8"))
js = (
    "// Generated from gifts.json by tools/sync_gifts_data.py.\n"
    "// Do not edit by hand; run the script after changing gifts.json.\n"
    "window.REGISTRY_GIFTS = "
    + json.dumps(data, indent=2, ensure_ascii=False)
    + ";\n"
)
OUT.write_text(js, encoding="utf-8", newline="")
print(f"Wrote {OUT} with {len(data)} gifts")
