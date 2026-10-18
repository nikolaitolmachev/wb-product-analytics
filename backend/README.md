# Local development

Keep the backend and frontend in separate terminals. Unless a command says
otherwise, run it from the repository root.

## Prerequisites

- Python 3.12 (verified with 3.12.3).
- Node.js 20.20.1 and npm 11.12.1, the versions verified with the existing
  frontend lockfile. Other Node.js versions have not been verified here.

## Backend

Create and activate a virtual environment, then install the application and
development dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements-dev.txt
python -m pip check
```

On Windows, use `py -3.12 -m venv .venv` and activate with
`.venv\Scripts\Activate.ps1` in PowerShell. For runtime dependencies only, install
`backend/requirements.txt` instead. Development requirements include runtime
requirements. Direct dependencies are pinned. Development requirements also pin
AnyIO for compatibility with Starlette's test client and strict warning checks.
Other transitive dependencies are resolved by pip rather than locked separately.

Run the checks:

```bash
python -m pytest -c backend/pytest.ini -W error
python -m ruff check backend/app backend/tests
python -m ruff format --check backend/app backend/tests
```

Start FastAPI:

```bash
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

- Products: <http://localhost:8000/api/products/>
- Swagger UI: <http://localhost:8000/docs>
- OpenAPI schema: <http://localhost:8000/openapi.json>

### Sample database and optional collection

The bundled `backend/data/sample.sqlite` contains 100 historical products, not
live marketplace data. The backend opens it read-only and rejects product
collection with HTTP 403 before calling the parser. Database paths do not depend
on the current working directory. The application never creates missing files
or tables automatically.

To enable collection into a separate local database, copy the sample once and
export its path before starting FastAPI:

```bash
cp -n backend/data/sample.sqlite backend/data/local.sqlite
export DATABASE_PATH=backend/data/local.sqlite
```

`DATABASE_PATH` must name an existing SQLite file with the existing schema;
relative paths resolve from the repository root. Writable paths pointing to the
sample, including file aliases, are rejected. Unset `DATABASE_PATH` to return to
read-only sample mode. `.env.example` documents this variable; `.env` is not
loaded automatically.

The original unofficial Wildberries search endpoint may no longer be accessible;
previous live verification returned HTTP 403. Writable storage does not guarantee
live collection will work. Viewing the sample and running tests require no
Wildberries access. Tests mock external requests and write only to temporary
databases; the sample checksum is checked before and after the test suite.

## Frontend

In a separate terminal, install from the existing lockfile and start React:

Stop an existing React development server before reinstalling dependencies.

```bash
cd frontend
npm ci
npm start
```

Open <http://localhost:3000>. Keep FastAPI running on port 8000; the React
development server proxies API requests there.

Build the frontend from `frontend/`:

```bash
npm run build
```

The generated files are written to `frontend/build/`. This command builds the
frontend only; it does not start a server or configure API hosting.
