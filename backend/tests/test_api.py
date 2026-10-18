"""Exercise API validation and atomic persistence using temporary SQLite files."""

import logging
from collections.abc import Iterator
from datetime import datetime
from unittest.mock import Mock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, event, func, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.main import app
from backend.app.models import Product
from backend.app.parser import (
    ParsedProduct,
    WBResponseError,
    WBSourceError,
    WBTimeoutError,
)


@pytest.fixture
def parsed_product() -> ParsedProduct:
    """Provide a valid parser result with nullable monetary attributes."""
    return {
        "id": 123,
        "name": "Updated name",
        "price_basic": None,
        "price_with_discount": 0.0,
        "rating": 0.0,
        "feedbacks": 0,
    }


@pytest.fixture
def mock_parser() -> Iterator[Mock]:
    """Keep collection fully offline, including tests of rejected requests."""
    with patch("backend.app.main.WBParser") as parser:
        yield parser


@pytest.fixture
def filtered_client(writable_client: TestClient, writable_engine: Engine) -> TestClient:
    """Seed representative boundary and null values in temporary storage."""
    with Session(writable_engine) as session:
        session.add_all(
            [
                Product(
                    id_wb=1, name="Low", price_with_discount=10, rating=4, feedbacks=5
                ),
                Product(
                    id_wb=2,
                    name="Middle",
                    price_with_discount=20,
                    rating=5,
                    feedbacks=10,
                ),
                Product(
                    id_wb=3,
                    name="High",
                    price_with_discount=30,
                    rating=4.5,
                    feedbacks=20,
                ),
                Product(id_wb=4, name="Unknown"),
            ]
        )
        session.commit()
    return writable_client


@pytest.mark.parametrize(
    "params,expected_ids",
    [
        ({}, {1, 2, 3, 4}),
        ({"min_price": 20}, {2, 3}),
        ({"max_price": 20}, {1, 2}),
        ({"min_rating": 4.5}, {2, 3}),
        ({"min_feedbacks": 10}, {2, 3}),
        ({"min_price": 20, "max_price": 20}, {2}),
        ({"min_price": 10, "max_price": 20, "min_rating": 5, "min_feedbacks": 10}, {2}),
        ({"min_feedbacks": 100}, set()),
    ],
)
def test_product_filters(
    filtered_client: TestClient, params: dict[str, int | float], expected_ids: set[int]
) -> None:
    response = filtered_client.get("/api/products/", params=params)
    assert response.status_code == 200
    assert {product["id_wb"] for product in response.json()} == expected_ids


@pytest.mark.parametrize(
    "params",
    [
        {"min_price": 30, "max_price": 20},
        {"min_price": -1},
        {"max_price": "inf"},
        {"min_price": "nan"},
        {"min_rating": 5.1},
        {"min_feedbacks": -1},
    ],
)
def test_invalid_filters_return_422(
    writable_client: TestClient, params: dict[str, int | float | str]
) -> None:
    assert writable_client.get("/api/products/", params=params).status_code == 422


@pytest.mark.parametrize(
    "payload",
    [
        {"query": ""},
        {"query": " \t\n "},
        {"query": "test", "pages": 0},
        {"query": "test", "pages": 101},
        {"query": "test", "pages": True},
        {"query": "test", "pages": 1.5},
    ],
)
def test_invalid_collection_input_never_calls_parser(
    writable_client: TestClient, mock_parser: Mock, payload: dict[str, object]
) -> None:
    response = writable_client.post("/api/parse-products/", json=payload)
    assert response.status_code == 422
    mock_parser.assert_not_called()


def test_empty_search_preserves_not_found_contract(
    writable_client: TestClient, mock_parser: Mock, writable_engine: Engine
) -> None:
    mock_parser.return_value.get_products.return_value = []
    response = writable_client.post("/api/parse-products/", json={"query": "  test  "})
    assert response.status_code == 404
    mock_parser.assert_called_once_with("test", 1)
    with Session(writable_engine) as session:
        assert session.scalar(select(func.count()).select_from(Product)) == 0


def test_collection_updates_names_and_deduplicates_before_insert(
    writable_client: TestClient,
    writable_engine: Engine,
    mock_parser: Mock,
    parsed_product: ParsedProduct,
) -> None:
    original_time = datetime(2020, 1, 1)
    with Session(writable_engine) as session:
        existing = Product(
            id_wb=123,
            name="Old name",
            price_basic=100,
            price_with_discount=80,
            rating=5,
            feedbacks=50,
            created_at=original_time,
            updated_at=original_time,
        )
        session.add(existing)
        session.commit()
        original_id = existing.id

    new_product: ParsedProduct = parsed_product.copy()
    new_product["id"] = 456
    new_product["name"] = "New product"
    mock_parser.return_value.get_products.return_value = [
        parsed_product,
        {**parsed_product, "name": "Duplicate update"},
        new_product,
        {**new_product, "name": "Duplicate insert"},
    ]
    response = writable_client.post("/api/parse-products/", json={"query": "test"})
    assert response.status_code == 200
    assert [product["name"] for product in response.json()] == [
        "Updated name",
        "New product",
    ]
    assert response.json()[0]["id"] == original_id

    with Session(writable_engine) as session:
        stored = session.scalars(select(Product).order_by(Product.id_wb)).all()
        assert len(stored) == 2
        assert stored[0].created_at == original_time
        assert stored[0].updated_at > original_time
        for product in stored:
            assert product.price_basic is None
            assert product.price_with_discount == 0
            assert product.rating == 0
            assert product.feedbacks == 0


@pytest.mark.parametrize("failure_stage", ["after_flush_postexec", "before_commit"])
def test_database_failure_rolls_back_the_entire_batch(
    writable_client: TestClient,
    writable_engine: Engine,
    mock_parser: Mock,
    parsed_product: ParsedProduct,
    failure_stage: str,
    caplog: pytest.LogCaptureFixture,
) -> None:
    with Session(writable_engine) as session:
        session.add(Product(id_wb=123, name="Original"))
        session.commit()

    mock_parser.return_value.get_products.return_value = [
        parsed_product,
        {**parsed_product, "id": 456},
    ]

    def fail_database_operation(*_args: object) -> None:
        raise OperationalError(
            "SECRET SQL", {"token": "SECRET TOKEN"}, Exception("SECRET")
        )

    with Session(writable_engine) as session:
        event.listen(session, failure_stage, fail_database_operation)

        def override_db() -> Iterator[Session]:
            yield session

        app.dependency_overrides[get_db] = override_db
        with caplog.at_level(logging.ERROR):
            response = writable_client.post(
                "/api/parse-products/", json={"query": "test"}
            )
        assert response.status_code == 500
        assert response.json() == {"detail": "Unable to save products."}
        assert "SECRET" not in response.text + caplog.text
        assert not session.in_transaction()
        stored = session.scalars(select(Product)).all()
        assert len(stored) == 1
        assert stored[0].name == "Original"
        assert stored[0].price_with_discount is None


@pytest.mark.parametrize(
    "failure,expected_status",
    [
        (WBTimeoutError("SECRET"), 504),
        (WBSourceError("SECRET", status_code=403), 502),
        (WBSourceError("SECRET", status_code=429), 502),
        (WBResponseError("SECRET"), 502),
    ],
)
def test_source_failures_are_safe_and_do_not_write(
    writable_client: TestClient,
    writable_engine: Engine,
    mock_parser: Mock,
    failure: WBSourceError,
    expected_status: int,
    caplog: pytest.LogCaptureFixture,
) -> None:
    mock_parser.return_value.get_products.side_effect = failure
    response = writable_client.post("/api/parse-products/", json={"query": "test"})
    assert response.status_code == expected_status
    assert "SECRET" not in response.text + caplog.text
    with Session(writable_engine) as session:
        assert session.scalar(select(func.count()).select_from(Product)) == 0


def test_read_failure_does_not_expose_sql(
    writable_client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    error = OperationalError("SECRET SQL", None, Exception("SECRET"))
    with patch.object(Session, "scalars", side_effect=error):
        response = writable_client.get("/api/products/")
    assert response.status_code == 500
    assert response.json() == {"detail": "Unable to read products."}
    assert "SECRET" not in response.text + caplog.text
