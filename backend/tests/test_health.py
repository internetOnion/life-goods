from fastapi import FastAPI
from fastapi.testclient import TestClient

from lifegoods.core.health import build_health_router


def test_liveness_does_not_check_dependencies() -> None:
    def unavailable() -> bool:
        raise AssertionError("must not probe")

    app = FastAPI()
    app.include_router(build_health_router(unavailable))
    with TestClient(app) as client:
        assert client.get("/api/health/live").json() == {"status": "alive"}


def test_readiness_reports_success_and_sanitized_failure() -> None:
    for healthy in (True, False):
        app = FastAPI()
        app.include_router(build_health_router(lambda healthy=healthy: healthy))
        with TestClient(app) as client:
            response = client.get("/api/health/ready")
            assert response.status_code == (200 if healthy else 503)
            assert response.headers["cache-control"] == "no-store"


def test_readiness_never_exposes_dependency_errors() -> None:
    def unavailable() -> bool:
        raise RuntimeError("mongodb://user:password@private-host")

    app = FastAPI()
    app.include_router(build_health_router(unavailable))
    with TestClient(app) as client:
        response = client.get("/api/health/ready")
        assert response.status_code == 503
        assert response.json() == {"status": "not_ready"}


def test_probe_checks_indexes_schema_and_redis_without_writing(monkeypatch) -> None:
    import fakeredis
    from test_open_food_facts_dataset import COLLECTION_NAME, VERSION_ID, dataset_database

    import lifegoods.core.health as health
    from lifegoods.core.settings import Settings
    from lifegoods.generated_data.schema import ensure_generated_data_schema
    from lifegoods.open_food_facts.search_index import build_search_index

    off = dataset_database()
    off[COLLECTION_NAME].insert_one({"code": "4006381333931", "product_name": "Test"})
    off[COLLECTION_NAME].create_index("code", unique=True, name="uq_off_code")
    build_search_index(off, VERSION_ID)
    generated = off.client.lifegoods_generated
    ensure_generated_data_schema(generated)
    cache = fakeredis.FakeRedis()
    monkeypatch.setattr(health, "MongoClient", lambda *args, **kwargs: off.client)
    monkeypatch.setattr(health.redis.Redis, "from_url", lambda *args, **kwargs: cache)
    probe = health.ReadinessProbe(Settings())
    before = off[COLLECTION_NAME].find_one()
    assert probe()
    assert off[COLLECTION_NAME].find_one() == before
    off[COLLECTION_NAME].drop_index("uq_off_code")
    assert not probe()
    off[COLLECTION_NAME].create_index("code", unique=True, name="uq_off_code")
    generated.translation_artifacts.drop_index("uq_translation_artifacts_artifact_id")
    app = FastAPI()
    app.include_router(build_health_router(probe))
    with TestClient(app) as client:
        assert client.get("/api/health/ready").status_code == 503
