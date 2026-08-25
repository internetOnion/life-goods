# ruff: noqa: E402
import sys
from datetime import UTC, datetime
from pathlib import Path
from tempfile import TemporaryDirectory

import uvicorn

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from lifegoods.adapters import catalog_models  # noqa: E402, F401
from lifegoods.adapters.database import Base, create_session_factory  # noqa: E402
from lifegoods.main import create_app  # noqa: E402
from lifegoods.matching.external_source import (  # noqa: E402
    ExternalLookupResult,
    ExternalPackageNotFound,
    ExternalSourceMetadata,
)
from lifegoods.matching.identifier import NormalizedIdentifier  # noqa: E402
from lifegoods.settings import Settings  # noqa: E402


class DeterministicNoMatchSource:
    metadata = ExternalSourceMetadata(
        name="Open Food Facts",
        source_type="COMMUNITY_DATABASE",
        base_url="https://world.openfoodfacts.org",
        attribution="Open Food Facts contributors",
        database_license="ODbL",
        contents_license="Database Contents License",
        image_license="CC BY-SA",
    )

    def fetch(self, identifier: NormalizedIdentifier) -> ExternalLookupResult:
        return ExternalPackageNotFound(
            identifier=identifier.value,
            request_url=(
                f"https://world.openfoodfacts.org/api/v3/product/{identifier.value}.json"
            ),
            retrieved_at=datetime(2026, 8, 24, 10, 0, tzinfo=UTC),
            raw_response=b'{"result":{"id":"product_not_found"}}',
            source=self.metadata,
        )

with TemporaryDirectory(prefix="lifegoods-e2e-") as temporary_directory:
    database_path = Path(temporary_directory) / "lifegoods.db"
    settings = Settings(database_url=f"sqlite+pysqlite:///{database_path}")
    session_factory = create_session_factory(settings)
    Base.metadata.create_all(session_factory.kw["bind"])

    uvicorn.run(
        create_app(
            settings=settings,
            session_factory=session_factory,
            external_source=DeterministicNoMatchSource(),
        ),
        host="127.0.0.1",
        port=8000,
    )
