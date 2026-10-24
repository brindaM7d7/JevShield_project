"""
db.py - SQLite Database Storage for JevShield Scan History

Manages:
- Table initialization (id, url, result, confidence, safety_score, created_at)
- Safe insertion using parameterized queries
- Retrieval of recent scans (default 10, ordered newest first)
- Configurable DB path via DATABASE_PATH environment variable
"""

import os
import sqlite3
from datetime import datetime


def get_db_path() -> str:
    """Return the configured SQLite database file path."""
    return os.environ.get("DATABASE_PATH", "jevshield.db")


def init_db(db_path: str = None) -> None:
    """
    Initialize SQLite database and create the scans table if it does not exist.
    """
    if db_path is None:
        db_path = get_db_path()

    conn = sqlite3.connect(db_path)
    try:
        with conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS scans (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    url TEXT NOT NULL,
                    result TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    safety_score INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans (created_at DESC)"
            )
    finally:
        conn.close()


def save_scan(url: str, result: str, confidence: float, safety_score: int, db_path: str = None) -> int:
    """
    Save a completed scan result into the database using parameterized queries.
    Returns the newly inserted row ID.
    """
    if db_path is None:
        db_path = get_db_path()

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = sqlite3.connect(db_path)
    try:
        with conn:
            cursor = conn.execute(
                """
                INSERT INTO scans (url, result, confidence, safety_score, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (url, result, float(confidence), int(safety_score), now),
            )
            return cursor.lastrowid
    finally:
        conn.close()


def get_recent_scans(limit: int = 10, db_path: str = None) -> list[dict]:
    """
    Retrieve the most recent scans ordered newest first.
    """
    if db_path is None:
        db_path = get_db_path()

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        cursor = conn.execute(
            """
            SELECT id, url, result, confidence, safety_score, created_at
            FROM scans
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        )
        rows = cursor.fetchall()
        return [
            {
                "id": row["id"],
                "url": row["url"],
                "result": row["result"],
                "confidence": round(row["confidence"], 4),
                "safety_score": row["safety_score"],
                "created_at": row["created_at"],
            }
            for row in rows
        ]
    finally:
        conn.close()
