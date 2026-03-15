"""
Telegram command handlers for the Xe Price Alert Bot.

Commands:
  /start   – welcome message
  /help    – usage instructions
  /alert <token> <price>  – set a price alert
  /list                   – show active alerts in this chat
  /remove <token>         – remove an alert
  /price <token>          – show current price
"""

import logging
from telegram import Update
from telegram.ext import ContextTypes

import database as db
import price_fetcher as pf

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

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
    tokens = ", ".join(pf.supported_tokens_list())
    text = (
        "📖 <b>Available Commands</b>\n\n"
        f"<b>Supported tokens:</b> {tokens}\n\n"
        "/alert &lt;token&gt; &lt;price&gt;\n"
        "  Set a price alert. Fires once when price ≥ target.\n"
        "  <i>Example:</i> /alert btc 70000\n\n"
        "/list\n"
        "  Show all active alerts in this chat.\n\n"
        "/remove &lt;token&gt;\n"
        "  Remove an active alert.\n"
        "  <i>Example:</i> /remove btc\n\n"
        "/price &lt;token&gt;\n"
        "  Show the current live price.\n"
        "  <i>Example:</i> /price eth"
    )
    await _reply(update, text)


# ──────────────────────────────────────────────────────────────────────────────
# /alert <token> <price>
# ──────────────────────────────────────────────────────────────────────────────

async def cmd_alert(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    args = context.args or []

    if len(args) != 2:
        await _reply(update, "⚠️ Usage: /alert &lt;token&gt; &lt;price&gt;\nExample: /alert btc 70000")
        return

    token = args[0].upper()
    if not pf.is_supported(token):
        supported = ", ".join(pf.supported_tokens_list())
        await _reply(update, f"⚠️ Unsupported token <b>{token}</b>.\nSupported: {supported}")
        return

    try:
        target_price = float(args[1].replace(",", ""))
        if target_price <= 0:
            raise ValueError
    except ValueError:
        await _reply(update, "⚠️ Price must be a positive number.\nExample: /alert btc 70000")
        return

    chat_id = update.effective_chat.id
    user = update.effective_user
    user_id = user.id if user else 0
    username = user.username if user else None

    await db.add_alert(chat_id, user_id, username, token, target_price)

    formatted = pf.format_price(target_price)
    await _reply(
        update,
        f"✅ Alert set!\n\n"
        f"Token: <b>{token}</b>\n"
        f"Target price: <b>{formatted}</b>\n\n"
        f"I'll notify this chat when {token} reaches {formatted}.",
    )
    logger.info("Alert set by %s in chat %s: %s @ %s", username, chat_id, token, target_price)


# ──────────────────────────────────────────────────────────────────────────────
# /list
# ──────────────────────────────────────────────────────────────────────────────

async def cmd_list(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id
    alerts = await db.get_alerts_for_chat(chat_id)

    if not alerts:
        await _reply(update, "📭 No active alerts in this chat.\nUse /alert &lt;token&gt; &lt;price&gt; to set one.")
        return

    lines = ["📋 <b>Active Alerts</b>\n"]
    for alert in alerts:
        formatted_price = pf.format_price(alert["target_price"])
        user_tag = f"@{alert['username']}" if alert.get("username") else "someone"
        lines.append(f"• <b>{alert['token']}</b> → {formatted_price}  (set by {user_tag})")

    await _reply(update, "\n".join(lines))


# ──────────────────────────────────────────────────────────────────────────────
# /remove <token>
# ──────────────────────────────────────────────────────────────────────────────

async def cmd_remove(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    args = context.args or []

    if not args:
        await _reply(update, "⚠️ Usage: /remove &lt;token&gt;\nExample: /remove btc")
        return

    token = args[0].upper()
    chat_id = update.effective_chat.id
    deleted = await db.remove_alert(chat_id, token)

    if deleted:
        await _reply(update, f"🗑️ Alert for <b>{token}</b> has been removed.")
        logger.info("Alert removed for %s in chat %s by %s", token, chat_id, _user_display(update))
    else:
        await _reply(update, f"⚠️ No active alert found for <b>{token}</b> in this chat.")


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
