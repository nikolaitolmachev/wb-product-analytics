# Frontend development

Use Node.js 24 LTS (24.15 or newer in the 24.x release line).
The verified version is recorded in `.nvmrc`.
Run the following commands from `frontend/`:

```bash
nvm use # If nvm is installed; install the specified Node version first if needed.
npm ci
npm run dev
```

Start the FastAPI backend separately on port 8000. Vite serves the frontend at
<http://localhost:5173> and proxies `/api` to <http://127.0.0.1:8000>.
The bundled dataset contains historical sample products, not live marketplace data.

```bash
npm test
npm run lint
npm run build
npm run preview
```

Tests mock the API and do not require a backend or Wildberries access.
The production build is written to `dist/`. The deployment environment must
route same-origin `/api/` requests to FastAPI. The development proxy is not
included in the production build, and `vite preview` is only a local preview.
