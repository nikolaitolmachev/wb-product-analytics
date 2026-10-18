"""Describe product responses and collection requests."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ProductBase(BaseModel):
    """Describe product attributes with prices expressed in rubles."""

    id_wb: int
    name: str
    price_basic: float | None = None
    price_with_discount: float | None = None
    rating: float | None = None
    feedbacks: int | None = None


class ProductCreate(ProductBase):
    """Describe the attributes accepted when creating a product."""


class Product(ProductBase):
    """Serialize a stored product, including its identifier and timestamps."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime | None
    updated_at: datetime | None


class ParseRequest(BaseModel):
    """Specify the query and bounded page count for product collection."""

    model_config = ConfigDict(str_strip_whitespace=True)

    query: str = Field(min_length=1, examples=["футболка женская"])
    pages: int = Field(1, ge=1, le=100, strict=True, examples=[3])
