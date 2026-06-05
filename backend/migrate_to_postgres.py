#!/usr/bin/env python3
"""
One-time migration script: SQLite → embedded PostgreSQL.

Called automatically by entrypoint.sh when:
  - /app/data/cotrainer.db exists (legacy SQLite file present)
  - The PostgreSQL 'users' table has no rows yet (fresh Postgres install)

Copies all rows in FK-dependency order, then resets each Postgres
sequence so auto-increment starts correctly after the imported IDs.
"""

import sys
import json
from datetime import datetime

from sqlalchemy import create_engine, inspect, text, MetaData, Table

SQLITE_URL = "sqlite:////app/data/cotrainer.db"

# Internal Postgres connection — same constant used everywhere in the app.
from config import INTERNAL_DB_URL

# Tables in the order they must be inserted to satisfy foreign-key constraints.
TABLE_ORDER = [
    "users",
    "practice_plans",
    "progression_charts",
    "plan_clones",
    "drill_cache",
    "sync_metadata",
]

# Sequences that must be reset after data import (table → sequence name).
SEQUENCES = {
    "users": "users_id_seq",
    "practice_plans": "practice_plans_id_seq",
    "progression_charts": "progression_charts_id_seq",
    "plan_clones": "plan_clones_id_seq",
    "sync_metadata": "sync_metadata_id_seq",
}


def _coerce_row(row: dict) -> dict:
    """Ensure JSON columns are stored as dicts/lists (not raw strings)."""
    coerced = {}
    for k, v in row.items():
        if isinstance(v, str):
            # Attempt to detect serialised JSON blobs stored as TEXT in SQLite.
            stripped = v.strip()
            if stripped and stripped[0] in ("{", "["):
                try:
                    v = json.loads(stripped)
                except (json.JSONDecodeError, ValueError):
                    pass
        coerced[k] = v
    return coerced


def migrate():
    sqlite_engine = create_engine(SQLITE_URL, connect_args={"check_same_thread": False})
    pg_engine = create_engine(INTERNAL_DB_URL, pool_pre_ping=True)

    # Reflect the SQLite schema so we can read tables that may not exist in
    # older installations (we skip missing ones gracefully).
    sqlite_meta = MetaData()
    sqlite_meta.reflect(bind=sqlite_engine)
    sqlite_tables = set(sqlite_meta.tables.keys())

    pg_inspector = inspect(pg_engine)
    pg_tables = set(pg_inspector.get_table_names())

    total_migrated = 0

    with pg_engine.begin() as pg_conn:
        # Temporarily disable FK checks during bulk insert.
        pg_conn.execute(text("SET session_replication_role = 'replica'"))

        for table_name in TABLE_ORDER:
            if table_name not in sqlite_tables:
                print(f"  [migrate] Skipping '{table_name}' — not in SQLite DB")
                continue
            if table_name not in pg_tables:
                print(f"  [migrate] Skipping '{table_name}' — not yet in Postgres schema (will be created by init_db)")
                continue

            # Read all rows from SQLite.
            with sqlite_engine.connect() as sq_conn:
                result = sq_conn.execute(text(f"SELECT * FROM {table_name}"))
                rows = [dict(r._mapping) for r in result]

            if not rows:
                print(f"  [migrate] '{table_name}': 0 rows (empty table, skipping)")
                continue

            rows = [_coerce_row(r) for r in rows]

            # Build a reflected Table object for Postgres so SQLAlchemy handles
            # column type mapping correctly.
            pg_meta = MetaData()
            pg_table = Table(table_name, pg_meta, autoload_with=pg_engine)

            pg_conn.execute(pg_table.insert(), rows)
            print(f"  [migrate] '{table_name}': inserted {len(rows)} rows")
            total_migrated += len(rows)

        # Re-enable FK checks.
        pg_conn.execute(text("SET session_replication_role = 'origin'"))

    # Reset sequences so nextval() won't collide with imported IDs.
    with pg_engine.begin() as pg_conn:
        for table_name, seq_name in SEQUENCES.items():
            if table_name not in pg_tables:
                continue
            # Check whether the sequence actually exists (DrillCache uses a
            # String PK so has no sequence).
            seq_exists = pg_conn.execute(
                text("SELECT 1 FROM pg_sequences WHERE sequencename = :s"),
                {"s": seq_name}
            ).fetchone()
            if not seq_exists:
                continue

            max_id = pg_conn.execute(
                text(f"SELECT COALESCE(MAX(id), 0) FROM {table_name}")
            ).scalar()
            pg_conn.execute(
                text(f"SELECT setval('{seq_name}', :v, true)"),
                {"v": max(max_id, 1)}
            )
            print(f"  [migrate] Reset sequence '{seq_name}' to {max(max_id, 1)}")

    print(f"\n[migrate] Done. {total_migrated} total rows migrated.")
    return True


if __name__ == "__main__":
    print("[migrate] Starting SQLite → PostgreSQL migration...")
    try:
        migrate()
        sys.exit(0)
    except Exception as exc:
        print(f"[migrate] ERROR: {exc}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
