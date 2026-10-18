"""Keep backend tests offline and verify the bundled dataset stays unchanged."""

import hashlib
from collections.abc import Iterator
from pathlib import Path
from unittest.mock import Mock

import pytest
import requests
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from backend.app import database
from backend.app.main import app


@pytest.fixture
def writable_engine(tmp_path: Path) -> Iterator[Engine]:
    """Create the existing schema in an isolated temporary SQLite file."""
    path = tmp_path / "working.sqlite"
    path.touch()
    engine = database.create_database_engine(path)
    database.Base.metadata.create_all(engine)
    try:
        yield engine
    finally:
        engine.dispose()


@pytest.fixture
def writable_client(writable_engine: Engine) -> Iterator[TestClient]:
    """Provide a request-scoped session bound only to temporary writable storage."""

    def override_db() -> Iterator[Session]:
        with Session(writable_engine) as session:
            yield session

    app.dependency_overrides[database.get_db] = override_db
    try:
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.clear()


@pytest.fixture(scope="session", autouse=True)
def preserve_sample_database() -> Iterator[None]:
    """Check the sample and its sidecar files before and after the suite."""
    path = Path(__file__).resolve().parents[1] / "data" / "sample.sqlite"
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    sidecars = set(path.parent.glob("sample.sqlite-*"))
    yield
    assert hashlib.sha256(path.read_bytes()).hexdigest() == digest
    assert set(path.parent.glob("sample.sqlite-*")) == sidecars


@pytest.fixture(autouse=True)
def block_external_requests(monkeypatch: pytest.MonkeyPatch) -> None:
    """Fail immediately if a test tries to contact an external service."""
    blocked = Mock(
        side_effect=AssertionError("External requests are forbidden in tests")
    )
    monkeypatch.setattr(requests.sessions.Session, "request", blocked)
    monkeypatch.setattr("socket.create_connection", blocked)
