"""Expose product filtering and explicitly enabled product collection."""

import logging
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from .database import get_db
from .models import Product
from .parser import ParsedProduct, WBParser, WBSourceError, WBTimeoutError
from .schemas import ParseRequest
from .schemas import Product as ProductResponse

logger = logging.getLogger(__name__)
app = FastAPI()


def _save_products(products: list[ParsedProduct], db: Session) -> list[ProductResponse]:
    """Insert or update a deduplicated batch in one transaction.

    The first occurrence of each ID wins, matching the parser. Response objects
    are validated before commit so serialization cannot trigger extra queries
    or fail after an otherwise successful write. The transaction rolls back
    automatically if flushing, validation, or commit fails.
    """
    unique_products: dict[int, ParsedProduct] = {}
    for product in products:
        unique_products.setdefault(product["id"], product)

    with db.begin():
        existing_products = {
            product.id_wb: product
            for product in db.scalars(
                select(Product).where(Product.id_wb.in_(unique_products))
            )
        }
        saved_products: list[Product] = []
        for product_id, product in unique_products.items():
            stored = existing_products.get(product_id)
            if stored is None:
                stored = Product(id_wb=product_id)
                db.add(stored)
            stored.name = product["name"]
            stored.price_basic = product["price_basic"]
            stored.price_with_discount = product["price_with_discount"]
            stored.rating = product["rating"]
            stored.feedbacks = product["feedbacks"]
            saved_products.append(stored)
        db.flush()
        return [ProductResponse.model_validate(product) for product in saved_products]


@app.post("/api/parse-products/", response_model=list[ProductResponse])
def parse_and_save_products(
    request: ParseRequest, db: Annotated[Session, Depends(get_db)]
) -> list[ProductResponse]:
    """Collect products and save them only to explicitly writable storage."""
    if db.get_bind().get_execution_options().get("read_only") is not False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Product collection is disabled for read-only or unconfigured storage.",
        )

    try:
        products = WBParser(request.query, request.pages).get_products()
    except WBTimeoutError:
        logger.warning("Product collection timed out")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Product source timed out.",
        ) from None
    except WBSourceError:
        logger.warning("Product collection source failure")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Product source is unavailable or returned an invalid response.",
        ) from None

    if not products:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No products found for the given query.",
        )

    try:
        result = _save_products(products, db)
    except SQLAlchemyError as error:
        # SQLAlchemy exception text can include SQL parameters and credentials.
        logger.error("Product persistence failed error_type=%s", type(error).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to save products.",
        ) from None
    logger.info("Saved product batch count=%d", len(result))
    return result


@app.get("/api/products/", response_model=list[ProductResponse])
def get_products(
    db: Annotated[Session, Depends(get_db)],
    min_price: float | None = Query(
        None, ge=0, allow_inf_nan=False, description="Minimum discounted price"
    ),
    max_price: float | None = Query(
        None, ge=0, allow_inf_nan=False, description="Maximum discounted price"
    ),
    min_rating: float | None = Query(
        None, ge=0, le=5, allow_inf_nan=False, description="Minimum rating"
    ),
    min_feedbacks: int | None = Query(None, ge=0, description="Minimum feedback count"),
) -> list[Product]:
    """Return products matching the inclusive price, rating, and feedback filters."""
    if min_price is not None and max_price is not None and min_price > max_price:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="min_price must not exceed max_price.",
        )

    query = select(Product)
    if min_price is not None:
        query = query.where(Product.price_with_discount >= min_price)
    if max_price is not None:
        query = query.where(Product.price_with_discount <= max_price)
    if min_rating is not None:
        query = query.where(Product.rating >= min_rating)
    if min_feedbacks is not None:
        query = query.where(Product.feedbacks >= min_feedbacks)

    try:
        return list(db.scalars(query))
    except SQLAlchemyError as error:
        logger.error("Product query failed error_type=%s", type(error).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to read products.",
        ) from None
