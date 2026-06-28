import sqlite3
from contextlib import contextmanager
import os

# Database file path
DB_PATH = os.path.join(os.path.dirname(
    os.path.dirname(__file__)), "db", "carelink.db")


def init_database():
    """Initialize the database, then apply idempotent migrations.

    The full schema is only written to a brand-new DB file. Tables added after
    the initial release are created via _run_migrations() on every startup so
    existing databases pick them up too (CREATE TABLE IF NOT EXISTS).
    """
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

    fresh = not os.path.exists(DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        if fresh:
            schema_path = os.path.join(os.path.dirname(
                os.path.dirname(__file__)), "db", "schema.sql")
            with open(schema_path, "r") as f:
                conn.executescript(f.read())

        _run_migrations(conn)
        conn.commit()
    finally:
        conn.close()


def _run_migrations(conn):
    """Idempotent, additive migrations for tables added after the first release.

    Keep DDL in sync with db/schema.sql (the canonical source). Only safe,
    non-destructive statements (CREATE TABLE/INDEX IF NOT EXISTS) belong here.
    """
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS reminders (
          reminder_id   INTEGER PRIMARY KEY AUTOINCREMENT,
          title         TEXT NOT NULL,
          kind          TEXT NOT NULL,
          recurrence    TEXT NOT NULL DEFAULT 'once',
          due_ts        INTEGER,
          time_of_day   TEXT,
          notes         TEXT,
          last_done_ts  INTEGER,
          active        INTEGER NOT NULL DEFAULT 1,
          created_ts    INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_reminders_active ON reminders(active);
    """)


@contextmanager
def db_cursor():
    """Context manager for database operations with proper cleanup."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    cursor = conn.cursor()
    try:
        yield cursor
        conn.commit()
    finally:
        cursor.close()
        conn.close()


@contextmanager
def db_connection():
    """Context manager for database connection when you need the connection object."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()
