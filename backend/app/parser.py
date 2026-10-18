"""Collect products from the historical, unofficial Wildberries search endpoint."""

import logging
import math
from typing import TypedDict

import requests

BASE_URL = "https://search.wb.ru/exactmatch/sng/common/v13/search"
MAX_PAGES = 100
REQUEST_TIMEOUT = (3.05, 10.0)
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
    ),
    "Referer": "https://www.google.com/",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "X-Requested-With": "XMLHttpRequest",
}
logger = logging.getLogger(__name__)


class ParsedProduct(TypedDict):
    """Describe the existing parser contract, with nullable prices in rubles."""

    id: int
    name: str
    price_basic: float | None
    price_with_discount: float | None
    rating: float | None
    feedbacks: int | None


class WBSourceError(Exception):
    """Report an unavailable source without exposing request or response content."""

    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        """Attach an optional upstream HTTP status for API error mapping."""
        super().__init__(message)
        self.status_code = status_code


class WBTimeoutError(WBSourceError):
    """Report that the source exceeded a connection or read timeout."""


class WBResponseError(WBSourceError):
    """Report invalid JSON, an unexpected payload, or an unusable product page."""


def _raw_products(payload: object) -> list[object]:
    """Reject malformed envelopes instead of treating them as empty searches."""
    if not isinstance(payload, dict):
        raise WBResponseError("Wildberries response must be a JSON object.")
    data = payload.get("data")
    if not isinstance(data, dict) or not isinstance(data.get("products"), list):
        raise WBResponseError("Wildberries response must contain a data.products list.")
    products_: list[object] = data["products"]
    return products_


def _optional_count(value: object, field: str) -> int | None:
    """Validate optional integer fields without accepting booleans as counts."""
    if value is None:
        return None
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise ValueError(f"{field} must be a non-negative integer or null")
    return value


def _price_in_rubles(value: object) -> float | None:
    """Convert whole kopecks to rubles while preserving missing and zero prices."""
    if value is None:
        return None
    # Integer strings were accepted by the original parser; fractional kopecks
    # must not be silently truncated by int().
    if isinstance(value, str) and value.isascii() and value.isdecimal():
        try:
            value = int(value)
        except ValueError:
            raise ValueError("price exceeds the supported numeric range") from None
    kopecks = _optional_count(value, "price")
    try:
        rubles = kopecks / 100 if kopecks is not None else None
    except OverflowError:
        raise ValueError("price exceeds the supported numeric range") from None
    if rubles is not None and not math.isfinite(rubles):
        raise ValueError("price must be finite")
    return rubles


def _normalize_product(raw: object) -> ParsedProduct:
    """Validate one record before it can reach the existing persistence layer."""
    if not isinstance(raw, dict):
        raise ValueError("product must be an object")
    product_id = _optional_count(raw.get("id"), "id")
    if product_id is None or not 1 <= product_id <= 2**63 - 1:
        raise ValueError("id must be a positive SQLite-compatible integer")
    name = raw.get("name")
    if not isinstance(name, str) or not name.strip():
        raise ValueError("name must be a non-empty string")

    rating = raw.get("reviewRating")
    if rating is not None:
        if (
            isinstance(rating, bool)
            or not isinstance(rating, (int, float))
            or not 0 <= rating <= 5
        ):
            raise ValueError("rating must be a finite number between 0 and 5 or null")
        rating = float(rating)
    feedbacks = _optional_count(raw.get("feedbacks"), "feedbacks")

    sizes = raw.get("sizes")
    price: dict[str, object] = {}
    if sizes is not None:
        if not isinstance(sizes, list):
            raise ValueError("sizes must be a list or null")
        if sizes:
            if not isinstance(sizes[0], dict):
                raise ValueError("the first size must be an object")
            raw_price = sizes[0].get("price")
            if raw_price is not None:
                if not isinstance(raw_price, dict):
                    raise ValueError("price must be an object or null")
                price = raw_price

    return {
        "id": product_id,
        "name": name.strip(),
        "price_basic": _price_in_rubles(price.get("basic")),
        "price_with_discount": _price_in_rubles(price.get("total")),
        "rating": rating,
        "feedbacks": feedbacks,
    }


class WBParser:
    """Collect bounded search pages using the original endpoint and product format."""

    def __init__(self, query: str, pages: int = 1) -> None:
        """Validate the search parameters without making network requests.

        Args:
            query: Non-empty product search text.
            pages: Maximum page count, from 1 through 100.

        Raises:
            ValueError: Search text or page count is invalid.
        """
        if not isinstance(query, str) or not query.strip():
            raise ValueError("query must be a non-empty string")
        if isinstance(pages, bool) or not isinstance(pages, int):
            raise ValueError("pages must be an integer")
        if not 1 <= pages <= MAX_PAGES:
            raise ValueError(f"pages must be between 1 and {MAX_PAGES}")
        self.query = query.strip()
        self.pages = pages

    @staticmethod
    def extract_products_info(response_data: object) -> list[ParsedProduct]:
        """Normalize a page, skipping invalid records and keeping the first ID.

        Missing optional attributes become None; zero remains a valid value.
        Prices are converted from integer kopecks to rubles. The first size is
        used, matching the original parser. Rejections log only safe reasons.

        Args:
            response_data: Decoded Wildberries response.

        Returns:
            Valid products in their original order, without duplicate IDs.

        Raises:
            WBResponseError: The response envelope is malformed.
        """
        products_: dict[int, ParsedProduct] = {}
        for index, raw in enumerate(_raw_products(response_data)):
            try:
                product = _normalize_product(raw)
            except ValueError as error:
                logger.warning(
                    "Skipping invalid product index=%d reason=%s", index, error
                )
                continue
            products_.setdefault(product["id"], product)
        return list(products_.values())

    def _fetch_page(self, page: int) -> object:
        """Fetch one page with bounded waits and always release its response."""
        params = {
            "ab_testing": "false",
            "appType": "1",
            "curr": "rub",
            "dest": "-59202",
            "hide_dtype": "10;13;14",
            "lang": "ru",
            "page": str(page),
            "query": self.query,
            "resultset": "catalog",
            "sort": "popular",
            "spp": "30",
            "suppressSpellcheck": "false",
        }
        try:
            response = requests.get(
                BASE_URL,
                headers=HEADERS,
                params=params,
                timeout=REQUEST_TIMEOUT,
                allow_redirects=False,
            )
        except requests.Timeout:
            logger.warning("Wildberries request timed out page=%d", page)
            raise WBTimeoutError("Wildberries request timed out.") from None
        except requests.RequestException:
            logger.warning("Wildberries request failed page=%d", page)
            raise WBSourceError("Wildberries request failed.") from None

        try:
            if response.status_code != 200:
                logger.warning(
                    "Wildberries HTTP failure page=%d status=%d",
                    page,
                    response.status_code,
                )
                raise WBSourceError(
                    "Wildberries returned an unsuccessful HTTP status.",
                    status_code=response.status_code,
                )
            try:
                return response.json()
            except ValueError:
                raise WBResponseError("Wildberries returned invalid JSON.") from None
        finally:
            response.close()

    def get_products(self) -> list[ParsedProduct]:
        """Collect unique products until an empty page or the page limit is reached.

        Returns:
            Valid products in page order. An empty successful search returns [].

        Raises:
            WBTimeoutError: A request times out.
            WBSourceError: Any page cannot be retrieved; partial results are discarded.
            WBResponseError: A page has an invalid envelope or no usable records.
        """
        products_: dict[int, ParsedProduct] = {}
        for page in range(1, self.pages + 1):
            payload = self._fetch_page(page)
            if not _raw_products(payload):
                break
            page_products = self.extract_products_info(payload)
            if not page_products:
                raise WBResponseError("Wildberries page contains no valid products.")
            for product in page_products:
                products_.setdefault(product["id"], product)
            logger.info(
                "Processed Wildberries page=%d products=%d", page, len(page_products)
            )
        return list(products_.values())


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    products = WBParser("футболка женская", 3).get_products()
    logger.info("Collected %d products", len(products))
