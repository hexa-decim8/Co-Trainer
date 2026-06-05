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
# 5b. Create auth schema and migrate users table into it (idempotent)
#     User account data is kept in the 'auth' schema, separate from the
#     application data tables which live in the default 'public' schema.
# ---------------------------------------------------------------------------
PGPASSWORD="${DB_PASS}" "${PG_BIN}/psql" \
    -h 127.0.0.1 -U "${DB_USER}" -d "${DB_NAME}" \
    -v ON_ERROR_STOP=1 <<-EOSQL

    -- Create the auth schema (no-op if it already exists)
    CREATE SCHEMA IF NOT EXISTS auth;

    DO \$\$
    BEGIN
        -- ----------------------------------------------------------------
        -- Migrate public.users → auth.users (only if not already done)
        -- ----------------------------------------------------------------
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'users'
        ) THEN
            RAISE NOTICE '[schema-migration] Moving public.users to auth.users';

            -- Drop FK constraints on child tables that reference public.users
            -- practice_plans.user_id
            IF EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'practice_plans_user_id_fkey'
                  AND table_schema = 'public'
            ) THEN
                ALTER TABLE public.practice_plans DROP CONSTRAINT practice_plans_user_id_fkey;
            END IF;

            -- plan_clones.user_id
            IF EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'plan_clones_user_id_fkey'
                  AND table_schema = 'public'
            ) THEN
                ALTER TABLE public.plan_clones DROP CONSTRAINT plan_clones_user_id_fkey;
            END IF;

            -- plan_clones.original_plan_id (FK to practice_plans — drop+recreate with CASCADE)
            IF EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'plan_clones_original_plan_id_fkey'
                  AND table_schema = 'public'
            ) THEN
                ALTER TABLE public.plan_clones DROP CONSTRAINT plan_clones_original_plan_id_fkey;
            END IF;

            -- plan_clones.cloned_plan_id (FK to practice_plans — drop+recreate with CASCADE)
            IF EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'plan_clones_cloned_plan_id_fkey'
                  AND table_schema = 'public'
            ) THEN
                ALTER TABLE public.plan_clones DROP CONSTRAINT plan_clones_cloned_plan_id_fkey;
            END IF;

            -- progression_charts.user_id
            IF EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'progression_charts_user_id_fkey'
                  AND table_schema = 'public'
            ) THEN
                ALTER TABLE public.progression_charts DROP CONSTRAINT progression_charts_user_id_fkey;
            END IF;

            -- Move the table to the auth schema
            ALTER TABLE public.users SET SCHEMA auth;

            RAISE NOTICE '[schema-migration] public.users moved to auth.users';
        ELSE
            RAISE NOTICE '[schema-migration] auth.users already in place, skipping move';
        END IF;

        -- ----------------------------------------------------------------
        -- Recreate / ensure FK constraints point at auth.users
        -- ----------------------------------------------------------------

        -- practice_plans.user_id → auth.users.id
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'practice_plans_user_id_fkey'
              AND table_schema = 'public'
        ) THEN
            ALTER TABLE public.practice_plans
                ADD CONSTRAINT practice_plans_user_id_fkey
                FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;

        -- plan_clones.user_id → auth.users.id
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'plan_clones_user_id_fkey'
              AND table_schema = 'public'
        ) THEN
            ALTER TABLE public.plan_clones
                ADD CONSTRAINT plan_clones_user_id_fkey
                FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;

        -- plan_clones.original_plan_id → public.practice_plans.id (CASCADE)
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'plan_clones_original_plan_id_fkey'
              AND table_schema = 'public'
        ) THEN
            ALTER TABLE public.plan_clones
                ADD CONSTRAINT plan_clones_original_plan_id_fkey
                FOREIGN KEY (original_plan_id) REFERENCES public.practice_plans(id) ON DELETE CASCADE;
        END IF;

        -- plan_clones.cloned_plan_id → public.practice_plans.id (CASCADE)
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'plan_clones_cloned_plan_id_fkey'
              AND table_schema = 'public'
        ) THEN
            ALTER TABLE public.plan_clones
                ADD CONSTRAINT plan_clones_cloned_plan_id_fkey
                FOREIGN KEY (cloned_plan_id) REFERENCES public.practice_plans(id) ON DELETE CASCADE;
        END IF;

        -- progression_charts.user_id → auth.users.id
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'progression_charts_user_id_fkey'
              AND table_schema = 'public'
        ) THEN
            ALTER TABLE public.progression_charts
                ADD CONSTRAINT progression_charts_user_id_fkey
                FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;

    END
    \$\$;
EOSQL

echo "[entrypoint] auth schema and FK constraints are up to date"

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
