#!/bin/bash
set -e

# ---------------------------------------------------------------------------
# Co-Trainer entrypoint
# Runs as root. Starts the embedded PostgreSQL server, performs one-time
# SQLite migration if needed, then drops to appuser and execs gunicorn.
# ---------------------------------------------------------------------------

PGDATA="${PGDATA:-/var/lib/postgresql/data}"
PG_LOG="/var/log/postgresql/postgresql.log"
DB_NAME="cotrainer"
DB_USER="cotrainer"
DB_PASS="cotrainer"
SQLITE_FILE="/app/data/cotrainer.db"

# ---------------------------------------------------------------------------
# 1. Resolve Postgres binary directory
# ---------------------------------------------------------------------------
PG_VERSION=$(ls /usr/lib/postgresql/ | sort -V | tail -1)
PG_BIN="/usr/lib/postgresql/${PG_VERSION}/bin"

echo "[entrypoint] Using PostgreSQL ${PG_VERSION} (${PG_BIN})"

# ---------------------------------------------------------------------------
# 2. Initialise data directory on first run
# ---------------------------------------------------------------------------
if [ ! -f "${PGDATA}/PG_VERSION" ]; then
    echo "[entrypoint] Initialising new PostgreSQL data directory at ${PGDATA}"
    gosu postgres "${PG_BIN}/initdb" \
        --pgdata="${PGDATA}" \
        --username=postgres \
        --auth-local=trust \
        --auth-host=md5 \
        --encoding=UTF8 \
        --locale=C
fi

# ---------------------------------------------------------------------------
# 3. Ensure pg_hba.conf allows the app user to connect via localhost TCP
# ---------------------------------------------------------------------------
PG_HBA="${PGDATA}/pg_hba.conf"
if ! grep -q "^host.*${DB_USER}" "${PG_HBA}" 2>/dev/null; then
    echo "host    ${DB_NAME}    ${DB_USER}    127.0.0.1/32    md5" >> "${PG_HBA}"
    echo "host    ${DB_NAME}    ${DB_USER}    ::1/128          md5" >> "${PG_HBA}"
fi

# ---------------------------------------------------------------------------
# 4. Start PostgreSQL and wait until it accepts connections
# ---------------------------------------------------------------------------
echo "[entrypoint] Starting PostgreSQL..."
gosu postgres "${PG_BIN}/pg_ctl" start \
    -D "${PGDATA}" \
    -w \
    -l "${PG_LOG}" \
    -o "-c listen_addresses='127.0.0.1,::1'"

echo "[entrypoint] PostgreSQL is ready"

# ---------------------------------------------------------------------------
# 5. Create role + database (idempotent)
# ---------------------------------------------------------------------------
gosu postgres "${PG_BIN}/psql" -v ON_ERROR_STOP=1 <<-EOSQL
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
            CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS}';
        END IF;
    END
    \$\$;

    SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')
    \gexec
EOSQL

echo "[entrypoint] Role '${DB_USER}' and database '${DB_NAME}' are ready"

# ---------------------------------------------------------------------------
# 6. One-time migration: SQLite → PostgreSQL
#    Only runs if the SQLite file exists and the users table is empty.
# ---------------------------------------------------------------------------
if [ -f "${SQLITE_FILE}" ]; then
    USER_COUNT=$(gosu postgres "${PG_BIN}/psql" -d "${DB_NAME}" -tAc \
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='users';" 2>/dev/null || echo "0")
    if [ "${USER_COUNT}" != "0" ]; then
        ROW_COUNT=$(PGPASSWORD="${DB_PASS}" "${PG_BIN}/psql" \
            -h 127.0.0.1 -U "${DB_USER}" -d "${DB_NAME}" -tAc \
            "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
    else
        ROW_COUNT="0"
    fi

    if [ "${ROW_COUNT}" = "0" ]; then
        echo "[entrypoint] Detected SQLite file and empty Postgres DB — running migration..."
        gosu appuser python /app/migrate_to_postgres.py
        echo "[entrypoint] Migration complete"
    else
        echo "[entrypoint] Postgres already has data (${ROW_COUNT} users) — skipping migration"
    fi
else
    echo "[entrypoint] No SQLite file found — fresh install, skipping migration"
fi

# ---------------------------------------------------------------------------
# 7. Launch gunicorn as non-root appuser
# ---------------------------------------------------------------------------
echo "[entrypoint] Starting gunicorn..."
exec gosu appuser gunicorn main:app \
    --workers 2 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:8000 \
    --preload \
    --access-logfile - \
    --error-logfile - \
    --log-level info
