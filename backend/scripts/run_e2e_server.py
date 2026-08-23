# ruff: noqa: E402
import sys
from pathlib import Path

import uvicorn

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from lifegoods.adapters import catalog_models  # noqa: E402, F401
from lifegoods.adapters.database import Base, create_session_factory  # noqa: E402
from lifegoods.main import create_app  # noqa: E402
from lifegoods.settings import Settings  # noqa: E402

database_path = Path(__file__).resolve().parents[1] / ".e2e.db"
settings = Settings(database_url=f"sqlite+pysqlite:///{database_path}")
session_factory = create_session_factory(settings)
Base.metadata.create_all(session_factory.kw["bind"])

uvicorn.run(
    create_app(settings=settings, session_factory=session_factory),
    host="127.0.0.1",
    port=8000,
)
