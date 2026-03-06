from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Dict, Any, Optional
from auth import get_current_user
from config import get_settings
import models
import httpx
import asyncio
import time

router = APIRouter(prefix="/api/prices", tags=["prices"])
settings = get_settings()

# Simple in-memory cache: {key: (data, timestamp)}
_cache: Dict[str, tuple] = {}
CACHE_TTL = 60  # seconds


def _get_cached(key: str) -> Optional[Any]:
    if key in _cache:
        data, ts = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return data
    return None


def _set_cached(key: str, data: Any):
    _cache[key] = (data, time.time())


@router.get("/crypto")
async def get_crypto_prices(
    ids: str = Query(..., description="Comma-separated CoinGecko IDs, e.g. bitcoin,ethereum"),
    current_user: models.User = Depends(get_current_user)
):
    cache_key = f"crypto:{ids}"
    cached = _get_cached(cache_key)
    if cached:
        return cached

    url = f"{settings.coingecko_base_url}/simple/price"
    params = {"ids": ids, "vs_currencies": "usd", "include_24hr_change": "true"}

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"CoinGecko API error: {str(e)}")

    result = {}
    for coin_id, prices in data.items():
        result[coin_id] = {
            "price": prices.get("usd", 0),
            "change_24h": prices.get("usd_24h_change", 0),
        }

    _set_cached(cache_key, result)
    return result


@router.get("/stock")
async def get_stock_price(
    symbol: str = Query(..., description="Stock ticker symbol, e.g. AAPL"),
    current_user: models.User = Depends(get_current_user)
):
    symbol = symbol.upper()
    cache_key = f"stock:{symbol}"
    cached = _get_cached(cache_key)
    if cached:
        return cached

    params = {
        "function": "GLOBAL_QUOTE",
        "symbol": symbol,
        "apikey": settings.alpha_vantage_api_key,
    }

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.get(settings.alpha_vantage_base_url, params=params)
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Alpha Vantage API error: {str(e)}")

    quote = data.get("Global Quote", {})
    if not quote:
        raise HTTPException(status_code=404, detail=f"Symbol {symbol} not found or API limit reached")

    result = {
        "symbol": symbol,
        "price": float(quote.get("05. price", 0)),
        "change_24h": float(quote.get("10. change percent", "0%").rstrip("%")),
    }
    _set_cached(cache_key, result)
    return result


@router.get("/forex")
async def get_forex_price(
    from_currency: str = Query(..., description="Base currency, e.g. EUR"),
    to_currency: str = Query(default="USD", description="Quote currency"),
    current_user: models.User = Depends(get_current_user)
):
    from_currency = from_currency.upper()
    to_currency = to_currency.upper()
    cache_key = f"forex:{from_currency}{to_currency}"
    cached = _get_cached(cache_key)
    if cached:
        return cached

    params = {
        "function": "CURRENCY_EXCHANGE_RATE",
        "from_currency": from_currency,
        "to_currency": to_currency,
        "apikey": settings.alpha_vantage_api_key,
    }

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.get(settings.alpha_vantage_base_url, params=params)
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Alpha Vantage API error: {str(e)}")

    rate_data = data.get("Realtime Currency Exchange Rate", {})
    if not rate_data:
        raise HTTPException(status_code=404, detail=f"Pair {from_currency}/{to_currency} not found or API limit reached")

    result = {
        "from": from_currency,
        "to": to_currency,
        "price": float(rate_data.get("5. Exchange Rate", 0)),
        "change_24h": 0.0,
    }
    _set_cached(cache_key, result)
    return result


@router.get("/bulk")
async def get_bulk_prices(
    crypto_ids: Optional[str] = Query(None, description="Comma-separated CoinGecko IDs"),
    stock_symbols: Optional[str] = Query(None, description="Comma-separated stock symbols"),
    current_user: models.User = Depends(get_current_user)
):
    """Fetch multiple prices in parallel."""
    results = {"crypto": {}, "stocks": {}}
    tasks = []

    if crypto_ids:
        tasks.append(("crypto", _fetch_crypto(crypto_ids)))

    if stock_symbols:
        symbols = [s.strip() for s in stock_symbols.split(",") if s.strip()]
        for sym in symbols:
            tasks.append((f"stock:{sym}", _fetch_stock(sym)))

    if tasks:
        keys = [t[0] for t in tasks]
        coros = [t[1] for t in tasks]
        responses = await asyncio.gather(*coros, return_exceptions=True)

        for key, resp in zip(keys, responses):
            if isinstance(resp, Exception):
                continue
            if key == "crypto":
                results["crypto"] = resp
            elif key.startswith("stock:"):
                sym = key.split(":")[1]
                results["stocks"][sym] = resp

    return results


async def _fetch_crypto(ids: str) -> dict:
    cache_key = f"crypto:{ids}"
    cached = _get_cached(cache_key)
    if cached:
        return cached
    url = f"{settings.coingecko_base_url}/simple/price"
    params = {"ids": ids, "vs_currencies": "usd", "include_24hr_change": "true"}
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
    result = {cid: {"price": p.get("usd", 0), "change_24h": p.get("usd_24h_change", 0)} for cid, p in data.items()}
    _set_cached(cache_key, result)
    return result


async def _fetch_stock(symbol: str) -> dict:
    cache_key = f"stock:{symbol}"
    cached = _get_cached(cache_key)
    if cached:
        return cached
    params = {"function": "GLOBAL_QUOTE", "symbol": symbol, "apikey": settings.alpha_vantage_api_key}
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(settings.alpha_vantage_base_url, params=params)
        resp.raise_for_status()
        data = resp.json()
    quote = data.get("Global Quote", {})
    result = {
        "symbol": symbol,
        "price": float(quote.get("05. price", 0)),
        "change_24h": float(quote.get("10. change percent", "0%").rstrip("%")),
    }
    _set_cached(cache_key, result)
    return result
