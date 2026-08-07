# Portfolio Dashboard

**A self-hosted prototype for tracking a mixed investment portfolio and understanding current value, allocation and unrealized performance in one place.**

> **Status:** working prototype. Suitable for local experimentation—not production financial infrastructure and not financial advice.

## Why it exists

Holdings often live across exchanges, brokers and spreadsheets. The difficult part is not displaying a price; it is keeping quantity, cost basis, provider identifiers and current market data consistent enough to answer:

- What do I own?
- What is it worth now?
- How much did I invest?
- What is the unrealized gain or loss?
- How is the portfolio distributed across asset types?

This project explores that workflow in a small self-hosted application.

## Capabilities

- User registration and JWT-based login.
- Per-user portfolio isolation at the API query level.
- Create, edit and delete holdings.
- Asset types:
  - cryptocurrency;
  - stocks and ETFs;
  - forex;
  - cash and stablecoins.
- Quantity and average buy-price tracking.
- Current price lookup through CoinGecko and Alpha Vantage.
- Live crypto market overview through Binance REST/WebSocket data.
- Portfolio value and unrealized P&L calculations in the browser.
- Automatic refresh.
- FastAPI OpenAPI/Swagger documentation.
- Persistent SQLite data through a Docker volume.
- Nginx frontend and reverse proxy.

## Architecture

```text
Browser
  |
  v
Nginx
  |-- static HTML/CSS/JavaScript
  |
  +--> /api/*
          |
          v
       FastAPI
       |-- JWT auth
       |-- portfolio CRUD
       |-- price aggregation/cache
       |
       +--> SQLite
       +--> CoinGecko
       +--> Alpha Vantage

Browser market view
       |
       +--> Binance REST + WebSocket
```

## Repository layout

```text
backend/
  main.py                 FastAPI application
  auth.py                 Password hashing and JWT helpers
  models.py               User and Asset models
  routers/auth.py         Registration, login and current user
  routers/portfolio.py    Holdings CRUD
  routers/prices.py       External price providers and cache
frontend/
  index.html              Login/registration
  dashboard.html          Portfolio and market views
  static/js/              API client, auth, dashboard and market logic
nginx/nginx.conf           Static hosting and API proxy
docker-compose.yml         Backend, frontend and persistent volume
scripts/setup-service.sh   Optional Linux service installer
```

## Quick start

### Requirements

- Docker Engine.
- Docker Compose.

### Run locally

```bash
cp .env.example .env
```

Before continuing, replace at least:

- `SECRET_KEY`
- `ALPHA_VANTAGE_API_KEY`

Then start the services:

```bash
docker compose up -d
```

Open:

- Dashboard: `http://localhost:8080`
- API docs: `http://localhost:8000/docs`

Stop without deleting the named data volume:

```bash
docker compose down
```

## Configuration

| Variable | Responsibility |
|---|---|
| `SECRET_KEY` | JWT signing secret |
| `ALGORITHM` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access-token lifetime |
| `DATABASE_URL` | SQLAlchemy database connection |
| `ALPHA_VANTAGE_API_KEY` | Stocks/forex provider credential |
| `COINGECKO_BASE_URL` | Crypto price API base URL |
| `PORT` | Public Nginx port |

Never commit the real `.env` file.

## Data model

### User

Stores username, optional email and a password hash.

### Asset

Stores:

- symbol and display name;
- asset type;
- quantity;
- average buy price;
- optional CoinGecko identifier;
- creation and update timestamps;
- owning user.

Current price and P&L are calculated from provider data rather than stored as authoritative history.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/auth/register` | Create a local user |
| `POST` | `/api/auth/login` | Obtain a bearer token |
| `GET` | `/api/auth/me` | Read the current user |
| `GET` | `/api/portfolio/assets` | List holdings |
| `POST` | `/api/portfolio/assets` | Add a holding |
| `PUT` | `/api/portfolio/assets/{id}` | Update a holding |
| `DELETE` | `/api/portfolio/assets/{id}` | Delete a holding |
| `POST` | `/api/prices/batch` | Resolve current prices |

Use the generated Swagger UI as the authoritative list if routes evolve.

## Security limitations

Do **not** expose the current repository directly to the internet without hardening it.

Known limitations:

- The backend contains a development fallback for `SECRET_KEY`; production must fail closed when no secret is provided.
- CORS currently allows every origin while credentials are enabled; restrict origins explicitly.
- Authentication is intentionally minimal: no MFA, email verification, password reset or session revocation.
- SQLite and a single application instance are designed for local/small-scale use.
- Provider errors and rate limits need stronger observability and retry policy.
- Browser-side market calls depend on third-party availability and policy.
- There is no automated test suite in the current tree.
- There is no documented backup/restore drill for the data volume.

## Verification checklist

Before calling a deployment production-ready:

- [ ] Remove the default signing-secret fallback.
- [ ] Restrict CORS to the deployed frontend.
- [ ] Add auth and portfolio API tests.
- [ ] Add provider timeout, retry and rate-limit tests.
- [ ] Verify backup and restore of `pd-data`.
- [ ] Add structured logs and health monitoring.
- [ ] Define HTTPS and reverse-proxy trust settings.
- [ ] Run a real register → login → add asset → price → P&L flow.

## Roadmap

1. Security hardening and automated tests.
2. Historical snapshots and performance over time.
3. Provider abstraction with clearer fallback behavior.
4. Import/export for portfolio data.
5. Backup/restore runbook.
6. Optional PostgreSQL migration if multi-user operation becomes real.

## Disclaimer

This software is an engineering prototype. Prices may be delayed, unavailable or incorrect. It does not provide investment, tax or accounting advice.

## License

No distribution license is currently declared. Treat the code as all-rights-reserved until one is added.
