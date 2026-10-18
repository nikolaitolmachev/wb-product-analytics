"""Verify normalization, bounded pagination, and explicit source failures offline."""

import json
import logging
from unittest.mock import Mock

import pytest
import requests

from backend.app.parser import (
    BASE_URL,
    REQUEST_TIMEOUT,
    WBParser,
    WBResponseError,
    WBSourceError,
    WBTimeoutError,
)


def _payload(*products: object) -> dict[str, object]:
    return {"data": {"products": list(products)}}


@pytest.fixture
def product() -> dict[str, object]:
    """Provide a complete product using the historical source format."""
    return {
        "id": 123,
        "name": "Product 1",
        "sizes": [{"price": {"basic": 1000, "total": 800}}],
        "reviewRating": 4.8,
        "feedbacks": 555,
    }


@pytest.fixture
def mock_get(monkeypatch: pytest.MonkeyPatch) -> Mock:
    """Replace all parser HTTP calls with a configurable response mock."""
    response = Mock(spec=requests.Response)
    response.status_code = 200
    get = Mock(return_value=response)
    monkeypatch.setattr("backend.app.parser.requests.get", get)
    return get


def test_valid_response_and_price_conversion(product: dict[str, object]) -> None:
    assert WBParser.extract_products_info(_payload(product)) == [
        {
            "id": 123,
            "name": "Product 1",
            "price_basic": 10.0,
            "price_with_discount": 8.0,
            "rating": 4.8,
            "feedbacks": 555,
        }
    ]


@pytest.mark.parametrize("sizes", [None, [], [{}], [{"price": None}], [{"price": {}}]])
def test_missing_prices_remain_null(sizes: object) -> None:
    product = {"id": 123, "name": "Product", "sizes": sizes}
    normalized = WBParser.extract_products_info(_payload(product))[0]
    assert normalized["price_basic"] is None
    assert normalized["price_with_discount"] is None
    assert normalized["rating"] is None
    assert normalized["feedbacks"] is None


def test_missing_fields_and_zero_values_are_distinct() -> None:
    missing = {"id": 123, "name": "Product"}
    zero = {
        **missing,
        "id": 456,
        "sizes": [{"price": {"basic": "0", "total": 0}}],
        "reviewRating": 0,
        "feedbacks": 0,
    }
    normalized = WBParser.extract_products_info(_payload(missing, zero))
    assert normalized[0]["price_basic"] is None
    assert normalized[1]["price_basic"] == 0.0
    assert normalized[1]["price_with_discount"] == 0.0
    assert normalized[1]["rating"] == 0.0
    assert normalized[1]["feedbacks"] == 0


@pytest.mark.parametrize(
    "invalid_fields",
    [
        {"id": None},
        {"id": True},
        {"id": 0},
        {"id": 2**63},
        {"name": "  "},
        {"name": 123},
        {"reviewRating": 5.1},
        {"reviewRating": float("nan")},
        {"reviewRating": True},
        {"feedbacks": -1},
        {"feedbacks": 1.5},
        {"sizes": {}},
        {"sizes": [None]},
        {"sizes": [{"price": []}]},
        {"sizes": [{"price": {"basic": -1}}]},
        {"sizes": [{"price": {"total": "invalid"}}]},
        {"sizes": [{"price": {"total": 0.5}}]},
        {"sizes": [{"price": {"total": float("inf")}}]},
        {"sizes": [{"price": {"total": True}}]},
    ],
)
def test_invalid_records_are_skipped_with_reasons(
    product: dict[str, object],
    invalid_fields: dict[str, object],
    caplog: pytest.LogCaptureFixture,
) -> None:
    with caplog.at_level(logging.WARNING):
        normalized = WBParser.extract_products_info(
            _payload(None, {**product, **invalid_fields}, product)
        )
    assert [item["id"] for item in normalized] == [123]
    assert len(caplog.records) == 2
    assert all("reason=" in record.message for record in caplog.records)


@pytest.mark.parametrize(
    "payload",
    [None, [], {}, {"data": None}, {"data": {}}, {"data": {"products": {}}}],
)
def test_malformed_envelope_is_a_source_failure(
    payload: object, mock_get: Mock
) -> None:
    mock_get.return_value.json.return_value = payload
    with pytest.raises(WBResponseError):
        WBParser("test", pages=3).get_products()
    mock_get.assert_called_once()
    mock_get.return_value.close.assert_called_once()


def test_empty_search_stops_after_first_page(mock_get: Mock) -> None:
    mock_get.return_value.json.return_value = _payload()
    assert WBParser("test", pages=3).get_products() == []
    mock_get.assert_called_once()
    mock_get.return_value.close.assert_called_once()


def test_invalid_only_page_is_not_an_empty_search(mock_get: Mock) -> None:
    mock_get.return_value.json.return_value = _payload({"name": "Missing ID"})
    with pytest.raises(WBResponseError, match="no valid products"):
        WBParser("test", pages=3).get_products()
    mock_get.assert_called_once()


def test_pagination_deduplicates_and_stops_on_empty_page(
    product: dict[str, object], mock_get: Mock
) -> None:
    mock_get.return_value.json.side_effect = [
        _payload(product, product),
        _payload({**product, "name": "Duplicate"}, {**product, "id": 456}),
        _payload(),
    ]
    products = WBParser("test", pages=5).get_products()
    assert [item["id"] for item in products] == [123, 456]
    assert products[0]["name"] == "Product 1"
    assert mock_get.call_count == 3
    assert mock_get.return_value.close.call_count == 3
    for page, call in enumerate(mock_get.call_args_list, start=1):
        assert call.args == (BASE_URL,)
        assert call.kwargs["params"]["page"] == str(page)
        assert call.kwargs["timeout"] == REQUEST_TIMEOUT
        assert call.kwargs["allow_redirects"] is False


def test_page_limit_is_respected(product: dict[str, object], mock_get: Mock) -> None:
    mock_get.return_value.json.return_value = _payload(product)
    assert len(WBParser("test", pages=2).get_products()) == 1
    assert mock_get.call_count == 2


@pytest.mark.parametrize(
    "failure",
    [
        403,
        429,
        500,
        302,
        requests.Timeout("SECRET"),
        requests.ConnectionError("SECRET"),
    ],
)
def test_page_failure_does_not_return_partial_success(
    failure: int | requests.RequestException,
    product: dict[str, object],
    mock_get: Mock,
    caplog: pytest.LogCaptureFixture,
) -> None:
    successful = mock_get.return_value
    successful.json.return_value = _payload(product)
    unsuccessful = Mock(spec=requests.Response)
    if isinstance(failure, int):
        unsuccessful.status_code = failure
        mock_get.side_effect = [successful, unsuccessful]
    else:
        mock_get.side_effect = [successful, failure]

    expected_error = (
        WBTimeoutError if isinstance(failure, requests.Timeout) else WBSourceError
    )
    with pytest.raises(expected_error) as caught:
        WBParser("PRIVATE QUERY", pages=3).get_products()
    assert mock_get.call_count == 2
    assert "SECRET" not in str(caught.value) + caplog.text
    assert "PRIVATE QUERY" not in str(caught.value) + caplog.text
    if isinstance(failure, int):
        assert caught.value.status_code == failure
        unsuccessful.close.assert_called_once()


def test_invalid_json_discards_previous_pages(
    product: dict[str, object], mock_get: Mock
) -> None:
    mock_get.return_value.json.side_effect = [
        _payload(product),
        json.JSONDecodeError("SECRET", "", 0),
    ]
    with pytest.raises(WBResponseError, match="invalid JSON") as caught:
        WBParser("test", pages=3).get_products()
    assert "SECRET" not in str(caught.value)
    assert mock_get.call_count == 2
    assert mock_get.return_value.close.call_count == 2


@pytest.mark.parametrize(
    "query,pages", [(" ", 1), ("test", 0), ("test", 101), ("test", True)]
)
def test_invalid_search_parameters_are_rejected(query: str, pages: int) -> None:
    with pytest.raises(ValueError):
        WBParser(query, pages)
