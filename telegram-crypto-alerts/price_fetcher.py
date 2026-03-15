"""
Fetches live cryptocurrency prices from the CoinGecko public API.
Includes a simple in-memory cache to avoid hitting rate limits when
multiple alerts are checked in the same polling cycle.
"""

import os
import time
import logging
import aiohttp
from typing import Optional

logger = logging.getLogger(__name__)

COINGECKO_API_URL = os.getenv(
    "COINGECKO_API_URL", "https://api.coingecko.com/api/v3"
)

# Map uppercase ticker → CoinGecko coin id
SUPPORTED_TOKENS: dict[str, str] = {
    "BTC": "bitcoin",
    "ETH": "ethereum",
    "SOL": "solana",
}

# Cache: { coin_id: (price_usd, fetched_at_unix_seconds) }
_price_cache: dict[str, tuple[float, float]] = {}
_CACHE_TTL = 10  # seconds – refresh at most every 10 s per coin


def is_supported(token: str) -> bool:
    return token.upper() in SUPPORTED_TOKENS


def supported_tokens_list() -> list[str]:
    return list(SUPPORTED_TOKENS.keys())


async def fetch_prices(tokens: list[str]) -> dict[str, Optional[float]]:
    """
    Fetch USD prices for a list of token tickers (e.g. ["BTC", "ETH"]).
    Returns { "BTC": 68000.0, "ETH": 3500.0, ... }.
    Uses cache to reduce API calls within the same polling window.
    """
    now = time.monotonic()
    results: dict[str, Optional[float]] = {}
    coins_to_fetch: list[str] = []  # coin ids that need a fresh fetch

    for token in tokens:
        token_upper = token.upper()
        coin_id = SUPPORTED_TOKENS.get(token_upper)
        if coin_id is None:
            results[token_upper] = None
            continue
        cached = _price_cache.get(coin_id)
        if cached and (now - cached[1]) < _CACHE_TTL:
            results[token_upper] = cached[0]
        else:
            coins_to_fetch.append(coin_id)

    if not coins_to_fetch:
        return results

    ids_param = ",".join(coins_to_fetch)
    url = f"{COINGECKO_API_URL}/simple/price?ids={ids_param}&vs_currencies=usd"

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status != 200:
                    logger.warning("CoinGecko returned HTTP %s", resp.status)
                    for coin_id in coins_to_fetch:
                        ticker = _coin_id_to_ticker(coin_id)
                        results[ticker] = None
                    return results
                data: dict = await resp.json()
    except Exception as exc:
        logger.error("Price fetch error: %s", exc)
        for coin_id in coins_to_fetch:
            ticker = _coin_id_to_ticker(coin_id)
            results[ticker] = None
        return results

    fetch_time = time.monotonic()
    for coin_id in coins_to_fetch:
        ticker = _coin_id_to_ticker(coin_id)
        price = data.get(coin_id, {}).get("usd")
        if price is not None:
            _price_cache[coin_id] = (float(price), fetch_time)
        results[ticker] = float(price) if price is not None else None

    return results


async def fetch_price(token: str) -> Optional[float]:
    """Convenience wrapper to fetch a single token price."""
    prices = await fetch_prices([token])
    return prices.get(token.upper())


def _coin_id_to_ticker(coin_id: str) -> str:
    for ticker, cid in SUPPORTED_TOKENS.items():
        if cid == coin_id:
            return ticker
    return coin_id.upper()


def format_price(price: float) -> str:
    """Format a USD price for display, e.g. $68,240 or $0.0042."""
    if price >= 1:
        return f"${price:,.2f}"
    return f"${price:.6f}"
