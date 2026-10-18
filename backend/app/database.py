"""Open the bundled sample read-only or an explicitly configured working database."""

import os
from collections.abc import Iterator
from pathlib import Path

from sqlalchemy import URL, Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SAMPLE_DATABASE_PATH = PROJECT_ROOT / "backend" / "data" / "sample.sqlite"


def create_database_engine(database_path: str | Path | None = None) -> Engine:
    """Create a SQLite engine without creating files or tables.

    Args:
        database_path: Separate writable file, relative to the project root or
            absolute. None selects the bundled read-only sample.

    Raises:
        FileNotFoundError: The selected database does not exist.
        ValueError: Writable storage points to the sample, including file aliases.
    """
    read_only = database_path is None
    path = SAMPLE_DATABASE_PATH if database_path is None else Path(database_path)
    if not path.is_absolute():
        path = PROJECT_ROOT / path
    path = path.resolve(strict=True)
    if not path.is_file():
        raise ValueError("SQLite storage must be an existing file.")
    if not read_only and (
        path == SAMPLE_DATABASE_PATH.resolve()
        or (SAMPLE_DATABASE_PATH.exists() and path.samefile(SAMPLE_DATABASE_PATH))
    ):
        raise ValueError("The sample database cannot be used as writable storage.")

    # URI modes prevent SQLite from silently creating a missing database.
    url = URL.create(
        "sqlite",
        database=path.as_uri(),
        query={"mode": "ro" if read_only else "rw", "uri": "true"},
    )
    return create_engine(
        url,
        connect_args={"check_same_thread": False},
        execution_options={"read_only": read_only},
    )


engine = create_database_engine(os.environ.get("DATABASE_PATH"))
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Provide the typed SQLAlchemy base for the existing database models."""


def get_db() -> Iterator[Session]:
    """Yield a request-scoped session and always close it."""
    with SessionLocal() as session:
        yield session
