from fastapi import FastAPI, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from .database import get_db
from .models import Product
from .schemas import Product as SProduct, ParseRequest
from .parser import WBParser

# create application
app = FastAPI()


@app.post('/api/parse-products/', response_model=List[SProduct])
def parse_and_save_products(request: ParseRequest, db: Session = Depends(get_db)):
    if db.get_bind().get_execution_options().get("read_only", False):
        raise HTTPException(
            status_code=403,
            detail="Product collection is disabled for the read-only sample database.",
        )

    processed_products = []

    parser = WBParser(request.query, request.pages)

    try:
        all_products = parser.get_products()
    except Exception as ex:
        raise HTTPException(status_code=500, detail=f'Parsing error: {str(ex)}')

    if not all_products:
        raise HTTPException(status_code=404, detail='No products found for the given query')

    for product in all_products:
        existing = db.query(Product).filter(Product.id_wb == product['id']).first()

        if existing:
            # update fields: price_basic, price_with_discount, rating, feedbacks, updated_at
            existing.price_basic = product['price_basic']
            existing.price_with_discount = product['price_with_discount']
            existing.rating = product['rating']
            existing.feedbacks = product['feedbacks']
            processed_products.append(existing)
        else:
            # insert new 'product'
            new_product = Product(
                id_wb=product['id'],
                name=product['name'],
                price_basic=product['price_basic'],
                price_with_discount=product['price_with_discount'],
                rating=product['rating'],
                feedbacks=product['feedbacks']
            )
            db.add(new_product)
            processed_products.append(new_product)

    db.commit()

    for product in processed_products:
        db.refresh(product)

    return processed_products


@app.get('/api/products/', response_model=List[SProduct])
def get_products(min_price: float = Query(None, ge=0, description="Minimal price"),
                max_price: float = Query(None, ge=0, description="Maximal price"),
                min_rating: float = Query(None, ge=0, le=5, description="Minimal rating"),
                min_feedbacks: int = Query(None, ge=0, description="Miminal count of feedbacks"),
                db: Session = Depends(get_db)):
    query = db.query(Product)

    if min_price is not None:
        query = query.filter(Product.price_with_discount >= min_price)
    if max_price is not None:
        query = query.filter(Product.price_with_discount <= max_price)
    if min_rating is not None:
        query = query.filter(Product.rating >= min_rating)
    if min_feedbacks is not None:
        query = query.filter(Product.feedbacks >= min_feedbacks)

    return query.all()
