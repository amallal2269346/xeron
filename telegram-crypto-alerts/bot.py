"""
Xe Price Alert Bot – main entry point.

Usage:
  1. Copy .env.example to .env and fill in BOT_TOKEN.
  2. pip install -r requirements.txt
  3. python bot.py
"""

import asyncio
import logging
import os
import sys

from dotenv import load_dotenv
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

import database as db
from handlers import cmd_start, cmd_help, cmd_alert, cmd_list, cmd_remove, cmd_price, cmd_tokens, cmd_active
from alert_checker import run_alert_loop

load_dotenv()

# ──────────────────────────────────────────────────────────────────────────────
# Logging
# ──────────────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)

# Suppress overly verbose libs
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)


# ──────────────────────────────────────────────────────────────────────────────
# Application lifecycle hooks
# ──────────────────────────────────────────────────────────────────────────────

async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    logger.error("Unhandled exception (update=%s): %s", update, context.error, exc_info=context.error)


async def post_init(application: Application) -> None:
    """Called once after the bot is fully initialised."""
    await db.init_db()
    logger.info("Database initialised.")

    # Start background alert-checker as a persistent asyncio task
    asyncio.create_task(run_alert_loop(application.bot))
    logger.info("Background alert loop scheduled.")


# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────

def main() -> None:
    token = os.getenv("BOT_TOKEN")
    if not token:
        logger.error("BOT_TOKEN is not set. Copy .env.example to .env and add your token.")
        sys.exit(1)

    app = (
        Application.builder()
        .token(token)
        .post_init(post_init)
        .build()
    )

    # Register command handlers
    app.add_handler(CommandHandler("start",  cmd_start))
    app.add_handler(CommandHandler("help",   cmd_help))
    app.add_handler(CommandHandler("alert",  cmd_alert))
    app.add_handler(CommandHandler("list",   cmd_list))
    app.add_handler(CommandHandler("remove", cmd_remove))
    app.add_handler(CommandHandler("price",  cmd_price))
    app.add_handler(CommandHandler("tokens", cmd_tokens))
    app.add_handler(CommandHandler("active", cmd_active))

    app.add_error_handler(error_handler)

    logger.info("Xe Price Alert Bot is running…")

    webhook_url = os.getenv("WEBHOOK_URL")
    if webhook_url:
        port = int(os.getenv("PORT", 8080))
        logger.info("Starting in webhook mode on port %d — %s", port, webhook_url)
        app.run_webhook(
            listen="0.0.0.0",
            port=port,
            webhook_url=webhook_url,
            drop_pending_updates=True,
            allowed_updates=Update.ALL_TYPES,
        )
    else:
        logger.info("Starting in polling mode (no WEBHOOK_URL set)")
        app.run_polling(
            drop_pending_updates=True,
            allowed_updates=Update.ALL_TYPES,
        )


if __name__ == "__main__":
    main()
