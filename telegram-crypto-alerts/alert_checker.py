"""
Background task that periodically checks all active alerts against live prices
and fires notifications when the target price is reached.

Logic:
  - Fetch the current price for every token that has at least one active alert.
  - For each alert where current_price >= target_price, send a Telegram message
    to the chat and then delete the alert so it never fires twice.
  - All token prices for a single cycle are batched into one API call to keep
    requests within CoinGecko's free-tier rate limits.
"""

import asyncio
import logging
import os
from collections import defaultdict

from telegram import Bot
from telegram.error import TelegramError

import database as db
import price_fetcher as pf

logger = logging.getLogger(__name__)

PRICE_CHECK_INTERVAL: int = int(os.getenv("PRICE_CHECK_INTERVAL", "15"))


async def _send_alert(bot: Bot, chat_id: int, token: str, target_price: float, current_price: float) -> None:
    text = (
        "🚨 <b>Price Alert</b>\n\n"
        f"<b>{token}</b> has reached {pf.format_price(target_price)}\n\n"
        f"Current Price: <b>{pf.format_price(current_price)}</b>"
    )
    try:
        await bot.send_message(chat_id=chat_id, text=text, parse_mode="HTML")
        logger.info("Alert fired for %s in chat %s (target=%s, current=%s)", token, chat_id, target_price, current_price)
    except TelegramError as exc:
        logger.error("Failed to send alert to chat %s: %s", chat_id, exc)


async def check_alerts(bot: Bot) -> None:
    """Single price-check cycle. Called repeatedly by the scheduler."""
    alerts = await db.get_all_alerts()
    if not alerts:
        return

    # Deduplicate tokens so we make as few API calls as possible
    unique_tokens = list({a["token"] for a in alerts})
    prices = await pf.fetch_prices(unique_tokens)

    # Group alerts by token for efficient look-up
    alerts_by_token: dict[str, list[dict]] = defaultdict(list)
    for alert in alerts:
        alerts_by_token[alert["token"]].append(alert)

    for token, token_alerts in alerts_by_token.items():
        current_price = prices.get(token)
        if current_price is None:
            logger.warning("Could not fetch price for %s — skipping this cycle", token)
            continue

        for alert in token_alerts:
            if current_price >= alert["target_price"]:
                await _send_alert(
                    bot,
                    chat_id=alert["chat_id"],
                    token=token,
                    target_price=alert["target_price"],
                    current_price=current_price,
                )
                await db.remove_alert_by_id(alert["id"])


async def run_alert_loop(bot: Bot) -> None:
    """
    Infinite loop that calls check_alerts every PRICE_CHECK_INTERVAL seconds.
    Designed to run as a background asyncio task alongside the Telegram updater.
    """
    logger.info("Alert checker started (interval=%ss)", PRICE_CHECK_INTERVAL)
    while True:
        try:
            await check_alerts(bot)
        except Exception as exc:  # noqa: BLE001
            logger.error("Unexpected error in alert loop: %s", exc, exc_info=True)
        await asyncio.sleep(PRICE_CHECK_INTERVAL)
