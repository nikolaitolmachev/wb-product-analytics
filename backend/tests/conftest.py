"""Keep backend tests offline and verify the bundled dataset stays unchanged."""

import hashlib
from collections.abc import Iterator
from pathlib import Path
from unittest.mock import Mock

import pytest
import requests


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
