"""Define product storage using the existing SQLite schema."""

from datetime import datetime, timezone

from sqlalchemy import BigInteger, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def _utc_now() -> datetime:
    """Return naive UTC to preserve the existing SQLite timestamp convention."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Product(Base):
    """Store a product and its latest observed attributes."""

    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_wb: Mapped[int | None] = mapped_column(BigInteger, unique=True, nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    price_basic: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_with_discount: Mapped[float | None] = mapped_column(Float, nullable=True)
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    feedbacks: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True, default=_utc_now
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True, default=_utc_now, onupdate=_utc_now
    )

    def __repr__(self) -> str:
        return (
            f"<Product(name={self.name}, price_basic={self.price_basic}, "
            f"price_with_discount={self.price_with_discount}, "
            f"rating={self.rating}, feedbacks={self.feedbacks})>"
        )
