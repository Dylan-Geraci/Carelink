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


DEFAULT_PATIENT_ID = "p_default"


def _add_column_if_missing(conn, table, column, decl):
    """ALTER TABLE ... ADD COLUMN, but only if the column isn't already there
    (SQLite has no ADD COLUMN IF NOT EXISTS)."""
    cols = [row[1] for row in conn.execute(f"PRAGMA table_info({table})")]
    if column not in cols:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {decl}")


def _run_migrations(conn):
    """Idempotent, additive migrations for changes made after the first release.

    Keep DDL in sync with db/schema.sql (the canonical source). Only safe,
    non-destructive statements (CREATE IF NOT EXISTS, ADD COLUMN, backfills).
    """
    import time

    # M3 — reminders.
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
          created_ts    INTEGER NOT NULL,
          patient_id    TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_reminders_active ON reminders(active);
    """)

    # M4 — local multi-profile (caregivers / patients / memberships).
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS caregivers (
          caregiver_id  TEXT PRIMARY KEY,
          email         TEXT,
          display_name  TEXT,
          created_ts    INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS patients (
          patient_id    TEXT PRIMARY KEY,
          name          TEXT NOT NULL,
          created_by    TEXT,
          created_ts    INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS memberships (
          membership_id INTEGER PRIMARY KEY AUTOINCREMENT,
          patient_id    TEXT NOT NULL,
          caregiver_id  TEXT,
          invited_email TEXT,
          role          TEXT NOT NULL DEFAULT 'caregiver',
          status        TEXT NOT NULL DEFAULT 'active',
          created_ts    INTEGER NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_membership_caregiver ON memberships(patient_id, caregiver_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_membership_invite ON memberships(patient_id, invited_email);
    """)

    # Add the owning-patient column to pre-M4 tables, then backfill everything
    # that predates ownership to a single default patient.
    _add_column_if_missing(conn, "sessions", "patient_id", "TEXT")
    _add_column_if_missing(conn, "reminders", "patient_id", "TEXT")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_sessions_patient ON sessions(patient_id)")

    now = int(time.time() * 1000)
    conn.execute(
        "INSERT OR IGNORE INTO patients (patient_id, name, created_ts) VALUES (?, ?, ?)",
        (DEFAULT_PATIENT_ID, "My patient", now),
    )
    conn.execute(
        "UPDATE sessions SET patient_id = ? WHERE patient_id IS NULL", (DEFAULT_PATIENT_ID,))
    conn.execute(
        "UPDATE reminders SET patient_id = ? WHERE patient_id IS NULL", (DEFAULT_PATIENT_ID,))


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
