# Frontend — Development Guide

React frontend for Wildberries Product Analytics, providing an interactive dashboard for exploring product prices, discounts, and ratings.

## Tech Stack

- React 19 and JavaScript
- Vite 8
- Material UI
- Recharts
- Axios
- Vitest, React Testing Library, and ESLint

## Installation

From the repository root:

```bash
cd frontend
nvm install
nvm use
npm ci
```

The project uses Node.js 24, configured in `.nvmrc`. Dependencies are installed from `package-lock.json`.

## Running the Application

With FastAPI running on port `8000`, start the frontend from `frontend/`:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

The Vite development server proxies `/api` requests to `http://127.0.0.1:8000`.

## Testing and Code Quality

Run the following commands from `frontend/`.

**Tests**

```bash
npm test
```

**ESLint**

```bash
npm run lint
```

**Production build**

```bash
npm run build
```

The production build is generated in `frontend/dist/`.

Frontend tests use mocked API responses and do not require a running backend.

The same checks are executed by GitHub Actions on pull requests targeting `main` and pushes to `main`.

## Production Configuration

The Vite development proxy is not included in production builds. The deployed application must route `/api` requests to the FastAPI backend.

---

[← Back to Project Overview](../README.md) · [Backend Development Guide](../backend/README.md)
