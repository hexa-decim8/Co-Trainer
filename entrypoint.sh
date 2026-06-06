#!/bin/bash
set -e

# ---------------------------------------------------------------------------
# Co-Trainer entrypoint
# Runs as root. Starts the embedded PostgreSQL server, then drops to appuser and execs gunicorn.
# ---------------------------------------------------------------------------

PGDATA="${PGDATA:-/var/lib/postgresql/data}"
PG_LOG="/var/log/postgresql/postgresql.log"
DB_NAME="cotrainer"
DB_USER="cotrainer"
DB_PASS="cotrainer"

# ---------------------------------------------------------------------------
# 1. Resolve Postgres binary directory
# ---------------------------------------------------------------------------
PG_VERSION=$(ls /usr/lib/postgresql/ | sort -V | tail -1)
PG_BIN="/usr/lib/postgresql/${PG_VERSION}/bin"

echo "[entrypoint] Using PostgreSQL ${PG_VERSION} (${PG_BIN})"

# ---------------------------------------------------------------------------
# 1b. Guard against PostgreSQL major-version mismatch
# ---------------------------------------------------------------------------
# If the data directory was created by a different PG major version the binary
# cannot open it.  Rather than crash-looping (or silently reinitialising and
# wiping all accounts), we detect the mismatch early and print clear recovery
# instructions.
if [ -f "${PGDATA}/PG_VERSION" ]; then
    DATA_PG_VERSION=$(cat "${PGDATA}/PG_VERSION" | tr -d '[:space:]')
    if [ "${DATA_PG_VERSION}" != "${PG_VERSION}" ]; then
        echo "========================================================================"
        echo "[entrypoint] FATAL: PostgreSQL version mismatch!"
        echo ""
        echo "  Installed binary version : ${PG_VERSION}"
        echo "  Data directory version   : ${DATA_PG_VERSION}"
        echo "  Data directory path      : ${PGDATA}"
        echo ""
        echo "  The data directory was created by PostgreSQL ${DATA_PG_VERSION} and"
        echo "  cannot be opened by PostgreSQL ${PG_VERSION}.  Starting the server"
        echo "  would fail, and reinitialising would DESTROY all user accounts and"
        echo "  saved data."
        echo ""
        echo "  To recover:"
        echo "    1) Restore a Dockerfile that installs postgresql-${DATA_PG_VERSION}"
        echo "    2) Start the container and run:"
        echo "         docker compose exec -T cotrainer pg_dump -U cotrainer -d cotrainer > backup.sql"
        echo "    3) Then switch to the new PG version, remove the old volume:"
        echo "         docker compose down -v"
        echo "    4) Start fresh and restore:"
        echo "         docker compose up -d"
        echo "         docker compose exec -T cotrainer psql -U cotrainer -d cotrainer < backup.sql"
        echo ""
        echo "  Alternatively, set PG_SKIP_VERSION_CHECK=1 to bypass this check"
        echo "  (only if you have already handled the migration yourself)."
        echo "========================================================================"
        if [ "${PG_SKIP_VERSION_CHECK}" != "1" ]; then
            exit 1
        fi
        echo "[entrypoint] PG_SKIP_VERSION_CHECK=1 — continuing despite mismatch"
    fi
fi

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
# 5b. Ensure auth schema exists (idempotent — also performed by SQLAlchemy init)
# ---------------------------------------------------------------------------
PGPASSWORD="${DB_PASS}" "${PG_BIN}/psql" \
    -h 127.0.0.1 -U "${DB_USER}" -d "${DB_NAME}" \
    -c "CREATE SCHEMA IF NOT EXISTS auth;"

echo "[entrypoint] auth schema ready"

# ---------------------------------------------------------------------------
# 5c. Optional pre-start backup (set PG_AUTO_BACKUP=1 in environment)
# ---------------------------------------------------------------------------
if [ "${PG_AUTO_BACKUP}" = "1" ]; then
    BACKUP_DIR="/app/config/backups"
    mkdir -p "${BACKUP_DIR}"
    BACKUP_FILE="${BACKUP_DIR}/cotrainer-$(date +%Y%m%d-%H%M%S).sql"
    echo "[entrypoint] PG_AUTO_BACKUP: dumping database to ${BACKUP_FILE}..."
    if PGPASSWORD="${DB_PASS}" "${PG_BIN}/pg_dump" \
        -h 127.0.0.1 -U "${DB_USER}" -d "${DB_NAME}" \
        > "${BACKUP_FILE}" 2>/dev/null; then
        echo "[entrypoint] PG_AUTO_BACKUP: backup saved ($(wc -c < "${BACKUP_FILE}") bytes)"
        # Keep only the 5 most recent backups
        ls -t "${BACKUP_DIR}"/cotrainer-*.sql 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
    else
        echo "[entrypoint] PG_AUTO_BACKUP: backup failed (database may be empty on first run)"
        rm -f "${BACKUP_FILE}"
    fi
fi

# ---------------------------------------------------------------------------
# 6. Launch gunicorn as non-root appuser
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
