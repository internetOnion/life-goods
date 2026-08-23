# ruff: noqa: E402
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from lifegoods.main import app

output_path = Path(__file__).resolve().parents[2] / "frontend" / "openapi.json"
output_path.write_text(
    json.dumps(app.openapi(), ensure_ascii=False, indent=2, sort_keys=True) + "\n",
    encoding="utf-8",
)
