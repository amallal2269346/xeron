"""
Fetches live cryptocurrency prices from the Binance public API.
No API key required. Works from cloud servers (Railway, Heroku, etc.).
"""

import time
import logging
import aiohttp
from typing import Optional

logger = logging.getLogger(__name__)

BINANCE_API_URL = "https://api.binance.com/api/v3/ticker/price"

# Map uppercase ticker → Binance USDT pair symbol
SUPPORTED_TOKENS: dict[str, str] = {
    "BTC":   "BTCUSDT",
    "ETH":   "ETHUSDT",
    "BNB":   "BNBUSDT",
    "SOL":   "SOLUSDT",
    "XRP":   "XRPUSDT",
    "DOGE":  "DOGEUSDT",
    "ADA":   "ADAUSDT",
    "TRX":   "TRXUSDT",
    "AVAX":  "AVAXUSDT",
    "SHIB":  "SHIBUSDT",
    "LINK":  "LINKUSDT",
    "DOT":   "DOTUSDT",
    "BCH":   "BCHUSDT",
    "NEAR":  "NEARUSDT",
    "LTC":   "LTCUSDT",
    "UNI":   "UNIUSDT",
    "MATIC": "MATICUSDT",
    "ICP":   "ICPUSDT",
    "APT":   "APTUSDT",
    "XLM":   "XLMUSDT",
    "ATOM":  "ATOMUSDT",
    "ETC":   "ETCUSDT",
    "OP":    "OPUSDT",
    "ARB":   "ARBUSDT",
    "HBAR":  "HBARUSDT",
    "FIL":   "FILUSDT",
    "VET":   "VETUSDT",
    "ALGO":  "ALGOUSDT",
    "XMR":   "XMRUSDT",
    "AAVE":  "AAVEUSDT",
    "MKR":   "MKRUSDT",
    "GRT":   "GRTUSDT",
    "FTM":   "FTMUSDT",
    "THETA": "THETAUSDT",
    "COMP":  "COMPUSDT",
    "SUI":   "SUIUSDT",
    "SEI":   "SEIUSDT",
    "INJ":   "INJUSDT",
    "PEPE":  "PEPEUSDT",
    "CRV":   "CRVUSDT",
    "SNX":   "SNXUSDT",
    "ZEC":   "ZECUSDT",
    "TAO":   "TAOUSDT",
    "WLD":   "WLDUSDT",
    "TON":   "TONUSDT",
    "RUNE":  "RUNEUSDT",
    "STX":   "STXUSDT",
    "FLOW":  "FLOWUSDT",
}

# Cache: { ticker: (price_usd, fetched_at_unix_seconds) }
_price_cache: dict[str, tuple[float, float]] = {}
_CACHE_TTL = 10  # seconds


def is_supported(token: str) -> bool:
    return token.upper() in SUPPORTED_TOKENS


def supported_tokens_list() -> list[str]:
    return list(SUPPORTED_TOKENS.keys())


async def fetch_prices(tokens: list[str]) -> dict[str, Optional[float]]:
    """
    Fetch USD prices for a list of token tickers (e.g. ["BTC", "ETH"]).
    Returns { "BTC": 68000.0, "ETH": 3500.0, ... }.
    """
    now = time.monotonic()
    results: dict[str, Optional[float]] = {}
    tokens_to_fetch: list[str] = []

    for token in tokens:
        token_upper = token.upper()
        if token_upper not in SUPPORTED_TOKENS:
            results[token_upper] = None
            continue
        cached = _price_cache.get(token_upper)
        if cached and (now - cached[1]) < _CACHE_TTL:
            results[token_upper] = cached[0]
        else:
            tokens_to_fetch.append(token_upper)

    if not tokens_to_fetch:
        return results

    # Build symbols list for Binance batch request
    symbols = [SUPPORTED_TOKENS[t] for t in tokens_to_fetch]

    try:
        async with aiohttp.ClientSession() as session:
            if len(symbols) == 1:
                url = f"{BINANCE_API_URL}?symbol={symbols[0]}"
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status != 200:
                        logger.warning("Binance returned HTTP %s", resp.status)
                        for t in tokens_to_fetch:
                            results[t] = None
                        return results
                    data = await resp.json()
                    data = [data]  # normalize to list
            else:
                import json
                symbols_param = json.dumps(symbols)
                url = f"{BINANCE_API_URL}?symbols={symbols_param}"
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status != 200:
                        logger.warning("Binance returned HTTP %s", resp.status)
                        for t in tokens_to_fetch:
                            results[t] = None
                        return results
                    data = await resp.json()
    except Exception as exc:
        logger.error("Price fetch error: %s", exc)
        for t in tokens_to_fetch:
            results[t] = None
        return results

    # Build reverse map: binance symbol → ticker
    symbol_to_ticker = {v: k for k, v in SUPPORTED_TOKENS.items()}

    fetch_time = time.monotonic()
    fetched_tickers = set()
    for item in data:
        ticker = symbol_to_ticker.get(item["symbol"])
        if ticker:
            price = float(item["price"])
            _price_cache[ticker] = (price, fetch_time)
            results[ticker] = price
            fetched_tickers.add(ticker)

    # Fill None for any that weren't returned
    for t in tokens_to_fetch:
        if t not in fetched_tickers:
            results[t] = None

    return results


async def fetch_price(token: str) -> Optional[float]:
    """Convenience wrapper to fetch a single token price."""
    prices = await fetch_prices([token])
    return prices.get(token.upper())


def format_price(price: float) -> str:
    """Format a USD price for display, e.g. $68,240 or $0.0042."""
    if price >= 1:
        return f"${price:,.2f}"
    return f"${price:.6f}"
