import mongomock
import pytest
from search_database_support import disposable_dataset
from search_database_support import test_connections as connections


def test_connections_never_default_to_application_database() -> None:
    assert connections({}) is None
    with pytest.raises(ValueError):
        connections(
            {
                "LIFEGOODS_TEST_OFF_MONGODB_READER_URI": "mongodb://localhost/lifegoods_off_test",
                "LIFEGOODS_TEST_OFF_MONGODB_WRITER_URI": "mongodb://localhost/lifegoods_off",
            }
        )
    database = mongomock.MongoClient().lifegoods_off
    with pytest.raises(ValueError), disposable_dataset(database):
        pytest.fail("Unsafe fixture entered")
    assert database.list_collection_names() == []


def test_disposable_fixture_cleans_up_when_test_fails() -> None:
    database = mongomock.MongoClient().lifegoods_off_test
    with pytest.raises(RuntimeError, match="test failure"), disposable_dataset(database) as fixture:
        _, source, search = fixture
        database[source].insert_one({"code": "4006381333931"})
        database[search].insert_one({"code": "4006381333931"})
        raise RuntimeError("test failure")
    assert all(database[name].count_documents({}) == 0 for name in database.list_collection_names())
