"""
SQLite database layer for storing and managing price alerts.
"""

import aiosqlite
import os
from typing import Optional

DB_PATH = os.getenv("DATABASE_PATH", "alerts.db")


async def init_db() -> None:
    """Create tables if they don't exist."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS alerts (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id      INTEGER NOT NULL,
                user_id      INTEGER NOT NULL,
                username     TEXT,
                token        TEXT NOT NULL,
                direction    TEXT NOT NULL DEFAULT 'above',
                target_price REAL NOT NULL,
                created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        # Migrate existing databases that lack the direction column
        try:
            await db.execute("ALTER TABLE alerts ADD COLUMN direction TEXT NOT NULL DEFAULT 'above'")
        except Exception:
            pass  # column already exists
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_alerts_chat ON alerts(chat_id)"
        )
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_alerts_token ON alerts(token)"
        )
        await db.commit()


async def add_alert(
    chat_id: int,
    user_id: int,
    username: Optional[str],
    token: str,
    direction: str,
    target_price: float,
) -> int:
    """
    Insert an alert. If one already exists for (chat_id, token, direction), replace it.
    direction must be 'above' or 'below'.
    Returns the new alert id.
    """
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "DELETE FROM alerts WHERE chat_id = ? AND token = ? AND direction = ?",
            (chat_id, token, direction),
        )
        cursor = await db.execute(
            """
            INSERT INTO alerts (chat_id, user_id, username, token, direction, target_price)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (chat_id, user_id, username, token, direction, target_price),
        )
        await db.commit()
        return cursor.lastrowid


async def get_alerts_for_chat(chat_id: int) -> list[dict]:
    """Return all active alerts for a specific chat."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM alerts WHERE chat_id = ? ORDER BY token, direction",
            (chat_id,),
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]


async def get_all_alerts() -> list[dict]:
    """Return every active alert (used by the price-check loop)."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM alerts") as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]


async def remove_alert(chat_id: int, token: str, direction: Optional[str] = None) -> bool:
    """
    Delete alert(s) by (chat_id, token) and optionally direction.
    Returns True if at least one was deleted.
    """
    async with aiosqlite.connect(DB_PATH) as db:
        if direction:
            cursor = await db.execute(
                "DELETE FROM alerts WHERE chat_id = ? AND token = ? AND direction = ?",
                (chat_id, token, direction),
            )
        else:
            cursor = await db.execute(
                "DELETE FROM alerts WHERE chat_id = ? AND token = ?",
                (chat_id, token),
            )
        await db.commit()
        return cursor.rowcount > 0


async def remove_alert_by_id(alert_id: int) -> None:
    """Delete an alert by its primary key (used after it triggers)."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM alerts WHERE id = ?", (alert_id,))
        await db.commit()
