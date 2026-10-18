"""Regression tests for sample protection and isolated writable databases."""

import os
import shutil
import subprocess
import sys
from collections.abc import Iterator
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, func, inspect, select, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from backend.app import database
from backend.app.main import app
from backend.app.models import Product


@pytest.fixture
def sample_client() -> Iterator[TestClient]:
    """Use an explicit read-only engine regardless of local configuration."""
    engine = database.create_database_engine()

    def override_db() -> Iterator[Session]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[database.get_db] = override_db
    try:
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_sample_products_are_readable(sample_client: TestClient) -> None:
    response = sample_client.get("/api/products/")
    assert response.status_code == 200
    assert len(response.json()) == 100
    assert all(product["name"] and product["id_wb"] for product in response.json())


def test_missing_sample_is_not_created(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path = tmp_path / "missing.sqlite"
    monkeypatch.setattr(database, "SAMPLE_DATABASE_PATH", path)
    with pytest.raises(FileNotFoundError):
        database.create_database_engine()
    assert not path.exists()


def test_sqlite_enforces_read_only_mode(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Exercise rejected writes against a disposable copy, never the bundled file.
    path = tmp_path / "sample.sqlite"
    shutil.copyfile(database.SAMPLE_DATABASE_PATH, path)
    before = path.read_bytes()
    monkeypatch.setattr(database, "SAMPLE_DATABASE_PATH", path)
    engine = database.create_database_engine()
    try:
        with engine.begin() as connection:
            with pytest.raises(OperationalError, match="readonly"):
                connection.execute(text("DELETE FROM products"))
    finally:
        engine.dispose()
    assert path.read_bytes() == before


@pytest.mark.parametrize("alias", ["direct", "symlink", "hardlink"])
def test_sample_cannot_be_configured_as_writable(
    tmp_path: Path, alias: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    path = database.SAMPLE_DATABASE_PATH
    if alias != "direct":
        # Keep hard links on the same filesystem and away from the bundled file.
        sample_copy = tmp_path / "sample.sqlite"
        shutil.copyfile(path, sample_copy)
        monkeypatch.setattr(database, "SAMPLE_DATABASE_PATH", sample_copy)
        path = tmp_path / "alias.sqlite"
        if alias == "symlink":
            path.symlink_to(sample_copy)
        else:
            path.hardlink_to(sample_copy)
    with pytest.raises(ValueError, match="cannot be used as writable"):
        database.create_database_engine(path)


def test_collection_is_forbidden_before_parser_call(sample_client: TestClient) -> None:
    with patch("backend.app.main.WBParser") as parser:
        response = sample_client.post(
            "/api/parse-products/", json={"query": "test", "pages": 1}
        )
    assert response.status_code == 403
    parser.assert_not_called()


def test_sample_path_is_independent_of_working_directory(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    engine = database.create_database_engine()
    try:
        with Session(engine) as session:
            assert session.scalar(select(func.count()).select_from(Product)) == 100
    finally:
        engine.dispose()
    assert not (tmp_path / "db.sqlite").exists()


def test_writable_storage_is_isolated(writable_engine: Engine) -> None:
    with Session(writable_engine) as session:
        assert session.scalar(select(func.count()).select_from(Product)) == 0
        session.add(Product(id_wb=123, name="Temporary product"))
        session.commit()
        assert session.scalar(select(func.count()).select_from(Product)) == 1


def test_collection_can_write_to_temporary_database(writable_engine: Engine) -> None:
    def override_db() -> Iterator[Session]:
        with Session(writable_engine) as session_:
            yield session_

    app.dependency_overrides[database.get_db] = override_db
    product = {
        "id": 123,
        "name": "Temporary product",
        "price_basic": 10.0,
        "price_with_discount": 8.0,
        "rating": 4.8,
        "feedbacks": 10,
    }
    try:
        with patch("backend.app.main.WBParser") as parser, TestClient(app) as client:
            parser.return_value.get_products.return_value = [product]
            response = client.post("/api/parse-products/", json={"query": "test"})
        assert response.status_code == 200
        assert response.json()[0]["id_wb"] == 123
        with Session(writable_engine) as session:
            assert session.scalar(select(func.count()).select_from(Product)) == 1
    finally:
        app.dependency_overrides.clear()


def test_import_does_not_create_tables(tmp_path: Path) -> None:
    path = tmp_path / "empty.sqlite"
    path.touch()
    env = {**os.environ, "DATABASE_PATH": str(path), "PYTHONDONTWRITEBYTECODE": "1"}
    subprocess.run(
        [sys.executable, "-c", "import backend.app.main"],
        cwd=database.PROJECT_ROOT,
        env=env,
        check=True,
        capture_output=True,
        text=True,
    )
    engine = database.create_database_engine(path)
    try:
        assert inspect(engine).get_table_names() == []
    finally:
        engine.dispose()


def test_relative_writable_path_uses_project_root(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path = tmp_path / "working.sqlite"
    path.touch()
    monkeypatch.setattr(database, "PROJECT_ROOT", tmp_path)
    engine = database.create_database_engine("working.sqlite")
    try:
        with engine.connect() as connection:
            assert (
                Path(connection.exec_driver_sql("PRAGMA database_list").one()[2])
                == path
            )
    finally:
        engine.dispose()


def test_missing_writable_database_is_not_created(tmp_path: Path) -> None:
    path = tmp_path / "missing.sqlite"
    with pytest.raises(FileNotFoundError):
        database.create_database_engine(path)
    assert not path.exists()
