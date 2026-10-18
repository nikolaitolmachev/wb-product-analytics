"""Test the original Wildberries parser using isolated HTTP mocks."""

import json
from unittest.mock import Mock

import pytest
import requests

from backend.app.parser import WBParser


@pytest.fixture
def parser() -> WBParser:
    """Create a parser without making requests."""
    return WBParser("футболка женская", pages=2)


@pytest.fixture
def response_data() -> dict[str, object]:
    """Provide a deterministic product payload for extraction and request tests."""
    return {
        "data": {
            "products": [
                {
                    "name": "Product 1",
                    "sizes": [{"price": {"basic": 1000, "total": 800}}],
                    "reviewRating": 4.8,
                    "feedbacks": 555,
                }
            ]
        }
    }


@pytest.fixture
def mock_get(monkeypatch: pytest.MonkeyPatch) -> Mock:
    """Replace the parser's HTTP calls with a configurable response mock."""
    response = Mock(spec=requests.Response)
    response.status_code = 200
    get = Mock(return_value=response)
    monkeypatch.setattr("backend.app.parser.requests.get", get)
    return get


def test_extract_products_info_valid(
    parser: WBParser, response_data: dict[str, object]
) -> None:
    result = parser.extract_products_info(response_data)

    assert len(result) == 1
    assert result[0]["name"] == "Product 1"
    # Source prices are kopecks; the existing API exposes rubles.
    assert result[0]["price_basic"] == 10.0
    assert result[0]["price_with_discount"] == 8.0
    assert result[0]["rating"] == 4.8
    assert result[0]["feedbacks"] == 555


def test_extract_products_info_empty(parser: WBParser) -> None:
    assert parser.extract_products_info({}) == []


def test_get_products_success(
    parser: WBParser, mock_get: Mock, response_data: dict[str, object]
) -> None:
    mock_get.return_value.json.return_value = response_data

    products = parser.get_products()

    assert products
    assert products[0]["name"] == "Product 1"
    assert mock_get.call_count == parser.pages


def test_get_products_request_exception(parser: WBParser, mock_get: Mock) -> None:
    mock_get.side_effect = requests.RequestException("Network error")

    assert parser.get_products() == []


def test_get_products_json_decode_error(parser: WBParser, mock_get: Mock) -> None:
    mock_get.return_value.json.side_effect = json.JSONDecodeError(
        "Expecting value", "", 0
    )

    assert parser.get_products() == []


def test_get_products_http_error(parser: WBParser, mock_get: Mock) -> None:
    mock_get.return_value.status_code = 500
    mock_get.return_value.raise_for_status.side_effect = requests.HTTPError(
        "Internal Server Error"
    )

    assert parser.get_products() == []
    mock_get.return_value.json.assert_not_called()
