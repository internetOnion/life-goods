from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from lifegoods.settings import Settings


class Base(DeclarativeBase):
    pass


def create_session_factory(settings: Settings) -> sessionmaker[Session]:
    engine = create_engine(settings.database_url, pool_pre_ping=True)
    return sessionmaker(engine, expire_on_commit=False)


def session_dependency(factory: sessionmaker[Session]) -> Iterator[Session]:
    with factory() as session:
        yield session
