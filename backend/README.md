# Backend — Development Guide

FastAPI backend for Wildberries Product Analytics, providing product filtering, SQLite storage, and optional product collection through the original Wildberries search integration.

## Tech Stack

- Python 3.12
- FastAPI and Pydantic
- SQLAlchemy and SQLite
- Requests
- pytest and Ruff

## Installation

From the repository root:

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
python -m pip check
```

Development dependencies include application dependencies, pytest, Ruff, and testing utilities.

For application dependencies only, use `requirements.txt` instead of `requirements-dev.txt`.

## Running the API

With the virtual environment activated, from `backend/`:

```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Available endpoints:**

| Endpoint | Description |
|---|---|
| `GET /api/products/` | Retrieve and filter stored products |
| `POST /api/parse-products/` | Collect and store products when a writable database is configured |
| `GET /docs` | Interactive Swagger API documentation |
| `GET /redoc` | Alternative API documentation |
| `GET /openapi.json` | OpenAPI schema |

**Product filters:** `min_price`, `max_price`, `min_rating`, and `min_feedbacks`.

Price filtering uses discounted prices in Russian rubles.

API documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

## Database Configuration

By default, the application uses `backend/data/sample.sqlite`, a read-only database containing 100 previously collected Wildberries products.

To enable writing, create a separate database from the sample and configure its path:

```bash
# Run from the repository root
cp backend/data/sample.sqlite backend/data/local.sqlite
export DATABASE_PATH=backend/data/local.sqlite
```

## Testing and Code Quality

Run the following commands from `backend/` with the development environment activated.

**Tests**

```bash
python -m pytest -W error
```

**Ruff linting**

```bash
python -m ruff check app tests
```

**Ruff formatting check**

```bash
python -m ruff format --check app tests
```

Backend tests use isolated temporary SQLite databases and mocked external requests. Network sockets are blocked during automated tests, preventing accidental calls to Wildberries.

The same checks are executed by GitHub Actions on pull requests targeting `main` and pushes to `main`.

## Known Limitations

The original parser uses an unofficial Wildberries API endpoint that may no longer be accessible (previously returned HTTP `403`).

Live product collection is not guaranteed, even with a writable database.

---

[← Back to Project Overview](../README.md) · [Frontend Development Guide](../frontend/README.md)
