"""
Background task that periodically checks all active alerts against live prices
and fires notifications when the condition is met.

Logic:
  - direction 'above': fires when current_price >= target_price
  - direction 'below': fires when current_price <= target_price
  - Alert fires once then is automatically removed.
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


async def _send_alert(
    bot: Bot,
    chat_id: int,
    token: str,
    direction: str,
    target_price: float,
    current_price: float,
) -> None:
    arrow = "📈" if direction == "above" else "📉"
    crossed = "risen above" if direction == "above" else "dropped below"
    text = (
        f"🚨 <b>Price Alert</b>\n\n"
        f"{arrow} <b>{token}</b> has {crossed} {pf.format_price(target_price)}\n\n"
        f"Current Price: <b>{pf.format_price(current_price)}</b>"
    )
    try:
        await bot.send_message(chat_id=chat_id, text=text, parse_mode="HTML")
        logger.info(
            "Alert fired: %s %s %s (current=%s) in chat %s",
            token, direction, target_price, current_price, chat_id,
        )
    except TelegramError as exc:
        logger.error("Failed to send alert to chat %s: %s", chat_id, exc)


async def check_alerts(bot: Bot) -> None:
    """Single price-check cycle."""
    alerts = await db.get_all_alerts()
    if not alerts:
        return

    unique_tokens = list({a["token"] for a in alerts})
    prices = await pf.fetch_prices(unique_tokens)

    alerts_by_token: dict[str, list[dict]] = defaultdict(list)
    for alert in alerts:
        alerts_by_token[alert["token"]].append(alert)

    for token, token_alerts in alerts_by_token.items():
        current_price = prices.get(token)
        if current_price is None:
            logger.warning("Could not fetch price for %s — skipping", token)
            continue

        for alert in token_alerts:
            direction = alert.get("direction", "above")
            target = alert["target_price"]

            triggered = (
                (direction == "above" and current_price >= target) or
                (direction == "below" and current_price <= target)
            )

            if triggered:
                await _send_alert(
                    bot,
                    chat_id=alert["chat_id"],
                    token=token,
                    direction=direction,
                    target_price=target,
                    current_price=current_price,
                )
                await db.remove_alert_by_id(alert["id"])


async def run_alert_loop(bot: Bot) -> None:
    """Infinite loop — runs check_alerts every PRICE_CHECK_INTERVAL seconds."""
    logger.info("Alert checker started (interval=%ss)", PRICE_CHECK_INTERVAL)
    while True:
        try:
            await check_alerts(bot)
        except Exception as exc:
            logger.error("Unexpected error in alert loop: %s", exc, exc_info=True)
        await asyncio.sleep(PRICE_CHECK_INTERVAL)
