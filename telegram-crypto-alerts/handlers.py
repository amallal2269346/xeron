"""
Telegram command handlers for the Xe Price Alert Bot.

Commands:
  /start   – welcome message
  /help    – usage instructions
  /alert <token> <above|below> <price>  – set a directional price alert
  /alert <token> <price>                – shorthand for 'above'
  /list                                 – show active alerts in this chat
  /remove <token> [above|below]         – remove an alert
  /price <token>                        – show current price
"""

import logging
from telegram import Update
from telegram.ext import ContextTypes

import database as db
import price_fetcher as pf

logger = logging.getLogger(__name__)


def _parse_price(value: str) -> float:
    """
    Parse a price string that may use k/m suffixes.
    Examples: '69k' -> 69000, '1.5m' -> 1500000, '70000' -> 70000
    """
    value = value.replace(",", "").strip().lower()
    if value.endswith("m"):
        return float(value[:-1]) * 1_000_000
    if value.endswith("k"):
        return float(value[:-1]) * 1_000
    return float(value)


def _user_display(update: Update) -> str:
    user = update.effective_user
    return f"@{user.username}" if user and user.username else (user.first_name if user else "Someone")


async def _reply(update: Update, text: str, parse_mode: str = "HTML") -> None:
    await update.effective_message.reply_text(text, parse_mode=parse_mode)


# ──────────────────────────────────────────────────────────────────────────────
# /start
# ──────────────────────────────────────────────────────────────────────────────

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = (
        "👋 <b>Xe Price Alert Bot</b>\n\n"
        "I send automatic cryptocurrency price alerts to this chat.\n\n"
        "Supported tokens: <b>BTC, ETH, SOL</b>\n\n"
        "Use /help to see all available commands."
    )
    await _reply(update, text)


# ──────────────────────────────────────────────────────────────────────────────
# /help
# ──────────────────────────────────────────────────────────────────────────────

async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = (
        "📖 <b>Available Commands</b>\n\n"
        "Supports <b>Top 50 cryptos</b> — use /tokens to see the full list.\n\n"
        "<b>Set an alert:</b>\n"
        "/alert &lt;token&gt; above &lt;price&gt;\n"
        "  Alert when price rises above target.\n"
        "  <i>Example:</i> /alert btc above 70000\n\n"
        "/alert &lt;token&gt; below &lt;price&gt;\n"
        "  Alert when price drops below target.\n"
        "  <i>Example:</i> /alert btc below 60000\n\n"
        "/alert &lt;token&gt; &lt;price&gt;\n"
        "  Shorthand for 'above'.\n"
        "  <i>Example:</i> /alert eth 4000\n\n"
        "/list\n"
        "  Show all active alerts in this chat.\n\n"
        "/remove &lt;token&gt; [above|below]\n"
        "  Remove an alert.\n"
        "  <i>Example:</i> /remove btc above\n"
        "  <i>Example:</i> /remove btc  (removes all BTC alerts)\n\n"
        "/price &lt;token&gt;\n"
        "  Show the current live price.\n"
        "  <i>Example:</i> /price eth"
    )
    await _reply(update, text)


# ──────────────────────────────────────────────────────────────────────────────
# /alert <token> [above|below] <price>
# ──────────────────────────────────────────────────────────────────────────────

async def cmd_alert(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    args = context.args or []

    if len(args) < 2:
        await _reply(
            update,
            "⚠️ Usage:\n"
            "/alert &lt;token&gt; above &lt;price&gt;\n"
            "/alert &lt;token&gt; below &lt;price&gt;\n"
            "/alert &lt;token&gt; &lt;price&gt;\n\n"
            "Examples:\n"
            "• /alert btc above 70000\n"
            "• /alert btc below 60000\n"
            "• /alert eth 4000"
        )
        return

    token = args[0].upper()
    if not pf.is_supported(token):
        supported = ", ".join(pf.supported_tokens_list())
        await _reply(update, f"⚠️ Unsupported token <b>{token}</b>.\nSupported: {supported}")
        return

    # Parse direction and price
    # Formats: /alert btc 70000  OR  /alert btc above 70000  OR  /alert btc below 60000
    if len(args) == 2:
        direction = "above"
        price_str = args[1]
    elif len(args) >= 3 and args[1].lower() in ("above", "below"):
        direction = args[1].lower()
        price_str = args[2]
    else:
        await _reply(
            update,
            "⚠️ Invalid format.\n\n"
            "Examples:\n"
            "• /alert btc above 70000\n"
            "• /alert btc below 60000\n"
            "• /alert eth 4000"
        )
        return

    try:
        target_price = _parse_price(price_str)
        if target_price <= 0:
            raise ValueError
    except ValueError:
        await _reply(update, "⚠️ Price must be a positive number.\nExamples: 70000 or 70k or 1.5m")
        return

    chat_id = update.effective_chat.id
    user = update.effective_user
    user_id = user.id if user else 0
    username = user.username if user else None

    await db.add_alert(chat_id, user_id, username, token, direction, target_price)

    formatted = pf.format_price(target_price)
    arrow = "📈" if direction == "above" else "📉"
    condition = "rises above" if direction == "above" else "drops below"

    await _reply(
        update,
        f"✅ Alert set!\n\n"
        f"Token: <b>{token}</b>\n"
        f"Direction: {arrow} <b>{direction.upper()}</b>\n"
        f"Target price: <b>{formatted}</b>\n\n"
        f"I'll notify this chat when {token} {condition} {formatted}.",
    )
    logger.info("Alert set by %s in chat %s: %s %s %s", username, chat_id, token, direction, target_price)


# ──────────────────────────────────────────────────────────────────────────────
# /list
# ──────────────────────────────────────────────────────────────────────────────

async def cmd_list(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id
    alerts = await db.get_alerts_for_chat(chat_id)

    if not alerts:
        await _reply(update, "📭 No active alerts in this chat.\nUse /alert to set one.")
        return

    lines = ["📋 <b>Active Alerts</b>\n"]
    for alert in alerts:
        formatted_price = pf.format_price(alert["target_price"])
        direction = alert.get("direction", "above")
        arrow = "📈" if direction == "above" else "📉"
        user_tag = f"@{alert['username']}" if alert.get("username") else "someone"
        lines.append(
            f"• <b>{alert['token']}</b> {arrow} {direction} {formatted_price}  (set by {user_tag})"
        )

    await _reply(update, "\n".join(lines))


# ──────────────────────────────────────────────────────────────────────────────
# /remove <token> [above|below]
# ──────────────────────────────────────────────────────────────────────────────

async def cmd_remove(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    args = context.args or []

    if not args:
        await _reply(update, "⚠️ Usage: /remove &lt;token&gt; [above|below]\nExamples:\n• /remove btc above\n• /remove btc")
        return

    token = args[0].upper()
    direction = args[1].lower() if len(args) >= 2 and args[1].lower() in ("above", "below") else None
    chat_id = update.effective_chat.id

    deleted = await db.remove_alert(chat_id, token, direction)

    if deleted:
        suffix = f" ({direction})" if direction else " (all)"
        await _reply(update, f"🗑️ Alert for <b>{token}</b>{suffix} has been removed.")
    else:
        await _reply(update, f"⚠️ No matching alert found for <b>{token}</b>{ ' ' + direction if direction else '' } in this chat.")


# ──────────────────────────────────────────────────────────────────────────────
# /tokens
# ──────────────────────────────────────────────────────────────────────────────

async def cmd_tokens(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    tokens = sorted(pf.supported_tokens_list())
    # Display in rows of 6
    rows = [tokens[i:i+6] for i in range(0, len(tokens), 6)]
    grid = "\n".join("  ".join(f"<code>{t}</code>" for t in row) for row in rows)
    await _reply(update, f"🪙 <b>Supported Tokens ({len(tokens)})</b>\n\n{grid}")


# ──────────────────────────────────────────────────────────────────────────────
# /price <token>
# ──────────────────────────────────────────────────────────────────────────────

async def cmd_price(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    args = context.args or []

    if not args:
        await _reply(update, "⚠️ Usage: /price &lt;token&gt;\nExample: /price btc")
        return

    token = args[0].upper()
    if not pf.is_supported(token):
        supported = ", ".join(pf.supported_tokens_list())
        await _reply(update, f"⚠️ Unsupported token <b>{token}</b>.\nSupported: {supported}")
        return

    await _reply(update, f"⏳ Fetching {token} price…")

    price = await pf.fetch_price(token)
    if price is None:
        await _reply(update, f"❌ Could not fetch price for <b>{token}</b>. Please try again later.")
        return

    await _reply(update, f"💰 <b>{token} Price:</b> {pf.format_price(price)}")
