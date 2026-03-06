# Portfolio Dashboard

Investment portfolio tracker with real-time prices.

**Tracks:** Crypto (CoinGecko), Stocks/ETFs (Alpha Vantage), Forex (Alpha Vantage), Cash/Stablecoins

## Stack

- **Backend:** Python + FastAPI + SQLite
- **Frontend:** HTML/CSS/JS (vanilla)
- **Reverse proxy:** Nginx
- **Containerized:** Docker Compose

## Quick Start

```bash
# 1. Copy and configure environment
cp .env.example .env
# Edit .env — set SECRET_KEY and ALPHA_VANTAGE_API_KEY

# 2. Start everything
docker compose up -d

# 3. Open the dashboard
open http://localhost:8080
```

## Configuration

| Variable | Description |
|---|---|
| `SECRET_KEY` | JWT signing key (generate with `openssl rand -hex 32`) |
| `ALPHA_VANTAGE_API_KEY` | Free key from alphavantage.co |
| `PORT` | Frontend port (default: 8080) |

## API Docs

Available at `http://localhost:8000/docs` (Swagger UI).

## Asset Types

| Type | Price Source | Symbol Example | CoinGecko ID |
|---|---|---|---|
| `crypto` | CoinGecko | BTC | bitcoin |
| `stock` | Alpha Vantage | AAPL | — |
| `forex` | Alpha Vantage | EUR | — |
| `cash` | Fixed $1.00 | USDT | — |

## Notes

- CoinGecko free tier: no API key required, rate limit ~10-30 req/min
- Alpha Vantage free tier: 25 requests/day (demo key), 500/day with free key
- Prices are cached for 60 seconds to avoid hitting rate limits
