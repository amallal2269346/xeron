"""
Fetches live cryptocurrency prices.
Primary source: Binance public API (no key needed).
Fallback source: CryptoCompare public API (no key needed).
"""

import json
import logging
import time
from typing import Optional

import aiohttp

logger = logging.getLogger(__name__)

BINANCE_URL = "https://api.binance.com/api/v3/ticker/price"
CRYPTOCOMPARE_URL = "https://min-api.cryptocompare.com/data/pricemulti"

# Map ticker → Binance USDT pair
BINANCE_SYMBOLS: dict[str, str] = {
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

SUPPORTED_TOKENS = BINANCE_SYMBOLS  # alias used by other modules

# Cache: { ticker: (price_usd, fetched_at_monotonic) }
_price_cache: dict[str, tuple[float, float]] = {}
_CACHE_TTL = 10  # seconds


def is_supported(token: str) -> bool:
    return token.upper() in SUPPORTED_TOKENS


def supported_tokens_list() -> list[str]:
    return list(SUPPORTED_TOKENS.keys())


# ── Binance ────────────────────────────────────────────────────────────────────

async def _fetch_from_binance(session: aiohttp.ClientSession, tickers: list[str]) -> dict[str, Optional[float]]:
    symbols = [BINANCE_SYMBOLS[t] for t in tickers]
    try:
        if len(symbols) == 1:
            url = f"{BINANCE_URL}?symbol={symbols[0]}"
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status != 200:
                    logger.warning("Binance HTTP %s for %s", resp.status, symbols[0])
                    return {}
                data = [await resp.json()]
        else:
            url = f"{BINANCE_URL}?symbols={json.dumps(symbols)}"
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status != 200:
                    logger.warning("Binance HTTP %s", resp.status)
                    return {}
                data = await resp.json()

        symbol_to_ticker = {v: k for k, v in BINANCE_SYMBOLS.items()}
        return {symbol_to_ticker[item["symbol"]]: float(item["price"])
                for item in data if item["symbol"] in symbol_to_ticker}

    except Exception as exc:
        logger.warning("Binance fetch failed (%s: %s) — trying fallback", type(exc).__name__, exc)
        return {}


# ── CryptoCompare fallback ─────────────────────────────────────────────────────

async def _fetch_from_cryptocompare(session: aiohttp.ClientSession, tickers: list[str]) -> dict[str, Optional[float]]:
    try:
        params = {"fsyms": ",".join(tickers), "tsyms": "USD"}
        async with session.get(CRYPTOCOMPARE_URL, params=params, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            if resp.status != 200:
                logger.error("CryptoCompare HTTP %s", resp.status)
                return {}
            data = await resp.json()
            if "Response" in data and data["Response"] == "Error":
                logger.error("CryptoCompare error: %s", data.get("Message", "unknown"))
                return {}
            return {ticker: float(data[ticker]["USD"])
                    for ticker in tickers if ticker in data and "USD" in data[ticker]}
    except Exception as exc:
        logger.error("CryptoCompare fetch failed (%s: %s)", type(exc).__name__, exc)
        return {}


# ── Public API ─────────────────────────────────────────────────────────────────

async def fetch_prices(tokens: list[str]) -> dict[str, Optional[float]]:
    """
    Fetch USD prices for a list of token tickers.
    Tries Binance first, falls back to CryptoCompare for any misses.
    """
    now = time.monotonic()
    results: dict[str, Optional[float]] = {}
    to_fetch: list[str] = []

    for token in tokens:
        t = token.upper()
        if t not in SUPPORTED_TOKENS:
            results[t] = None
            continue
        cached = _price_cache.get(t)
        if cached and (now - cached[1]) < _CACHE_TTL:
            results[t] = cached[0]
        else:
            to_fetch.append(t)

    if not to_fetch:
        return results

    async with aiohttp.ClientSession() as session:
        # Primary: Binance
        fetched = await _fetch_from_binance(session, to_fetch)

        # Fallback: CryptoCompare for anything Binance didn't return
        missed = [t for t in to_fetch if t not in fetched]
        if missed:
            logger.info("Falling back to CryptoCompare for: %s", missed)
            fallback = await _fetch_from_cryptocompare(session, missed)
            fetched.update(fallback)

    fetch_time = time.monotonic()
    for t in to_fetch:
        price = fetched.get(t)
        if price is not None:
            _price_cache[t] = (price, fetch_time)
        results[t] = price

    return results


async def fetch_price(token: str) -> Optional[float]:
    """Fetch a single token price."""
    prices = await fetch_prices([token])
    return prices.get(token.upper())


def format_price(price: float) -> str:
    if price >= 1:
        return f"${price:,.2f}"
    return f"${price:.6f}"
