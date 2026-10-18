"""Define product storage using the existing SQLite schema."""

from datetime import UTC, datetime

from sqlalchemy import BigInteger, Column, DateTime, Float, Integer, String

from .database import Base


def _utc_now() -> datetime:
    """Return naive UTC to preserve the existing SQLite timestamp convention."""
    return datetime.now(UTC).replace(tzinfo=None)


class Product(Base):
    """Store a product and its latest observed attributes."""

    __tablename__ = "products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_wb = Column(BigInteger, unique=True)  # Product identifier on Wildberries.
    name = Column(String, nullable=False)
    price_basic = Column(Float, nullable=True)
    price_with_discount = Column(Float, nullable=True)
    rating = Column(Float, nullable=True)
    feedbacks = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=_utc_now)
    updated_at = Column(DateTime, default=_utc_now, onupdate=_utc_now)

    def __repr__(self) -> str:
        return (
            f"<Product(name={self.name}, price_basic={self.price_basic}, "
            f"price_with_discount={self.price_with_discount}, "
            f"rating={self.rating}, feedbacks={self.feedbacks})>"
        )
