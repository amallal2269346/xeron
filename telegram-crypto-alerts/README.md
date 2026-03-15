# Xe Price Alert Bot

A Telegram bot that sends cryptocurrency price alerts to a group chat.
Prices are fetched from the [CoinGecko](https://www.coingecko.com/) public API (no API key required).

---

## Features

| Command | Description |
|---|---|
| `/alert <token> <price>` | Set a price alert (fires once, then auto-removes) |
| `/list` | Show all active alerts in this chat |
| `/remove <token>` | Remove an alert |
| `/price <token>` | Fetch the current live price |
| `/help` | Show usage instructions |

**Supported tokens:** BTC, ETH, SOL

---

## Quick Start

### 1. Create your bot

1. Open [@BotFather](https://t.me/BotFather) in Telegram.
2. Send `/newbot` and follow the prompts.
3. Copy the **bot token** you receive.
4. Add the bot to your group and promote it so it can send messages.

### 2. Local setup

```bash
# Clone / navigate to the project
cd telegram-crypto-alerts

# Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and set BOT_TOKEN=<your token>

# Run
python bot.py
```

---

## Production Deployment (VPS / systemd)

```bash
# Copy files to server
scp -r telegram-crypto-alerts/ user@your-vps:/opt/xe-price-alert-bot

# On the VPS
cd /opt/xe-price-alert-bot
python3 -m venv venv
venv/bin/pip install -r requirements.txt
cp .env.example .env
nano .env   # set BOT_TOKEN

# Install and start the systemd service
sudo cp xe-price-alert-bot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable xe-price-alert-bot
sudo systemctl start  xe-price-alert-bot

# Check logs
sudo journalctl -u xe-price-alert-bot -f
```

---

## Configuration (`.env`)

| Variable | Default | Description |
|---|---|---|
| `BOT_TOKEN` | _(required)_ | Telegram bot token from BotFather |
| `PRICE_CHECK_INTERVAL` | `15` | Seconds between price checks |
| `DATABASE_PATH` | `alerts.db` | SQLite database file path |
| `COINGECKO_API_URL` | CoinGecko v3 | Override for testing/proxying |

---

## Architecture

```
bot.py              ← entry point, wires everything together
handlers.py         ← Telegram command handlers
alert_checker.py    ← background asyncio loop (fires alerts)
price_fetcher.py    ← CoinGecko API client with in-memory cache
database.py         ← async SQLite CRUD via aiosqlite
```

### Alert flow

```
User: /alert btc 70000
         │
         ▼
  database.add_alert()
         │
  [every 15 s]
         │
         ▼
  price_fetcher.fetch_prices(["BTC", ...])
         │
  current_price >= target_price?
         │  yes
         ▼
  bot.send_message()  →  "🚨 BTC has reached $70,000"
  database.remove_alert_by_id()
```

---

## Adding More Tokens

Edit `SUPPORTED_TOKENS` in `price_fetcher.py`:

```python
SUPPORTED_TOKENS: dict[str, str] = {
    "BTC": "bitcoin",
    "ETH": "ethereum",
    "SOL": "solana",
    "DOGE": "dogecoin",   # ← add new tokens here
    "MATIC": "matic-network",
}
```

The CoinGecko coin ID can be found at `https://api.coingecko.com/api/v3/coins/list`.
