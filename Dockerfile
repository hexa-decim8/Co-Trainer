# Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Build backend runtime
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (including PostgreSQL server and gosu for privilege drop)
# PostgreSQL is installed from the official PGDG apt repository with a pinned
# major version (17) so the data directory format never changes between image
# builds regardless of which Debian release the python base image uses.
#
# !! CRITICAL: Do NOT change the postgresql-17 version without a migration plan.
# !! The persisted data volume (cotrainer_pgdata) is formatted for this major
# !! version. Changing it (e.g. to postgresql-18) will make the container unable
# !! to start against existing data, forcing a volume wipe that DESTROYS all
# !! user accounts and saved plans. See entrypoint.sh for the version-mismatch
# !! guard and DEPLOYMENT.md for the upgrade procedure.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gnupg \
    lsb-release \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
       | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
       > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    gosu \
    postgresql-17 \
    && rm -rf /var/lib/apt/lists/*

# Copy Python dependencies and install
COPY backend/requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt gunicorn

# Copy backend code
COPY backend/ ./

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/dist ./static

# Copy entrypoint (must run as root to start Postgres, then drops to appuser)
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# PostgreSQL data directory (volume-mounted for persistence)
ENV PGDATA=/var/lib/postgresql/data
RUN mkdir -p /var/lib/postgresql/data /var/log/postgresql && \
    chown -R postgres:postgres /var/lib/postgresql /var/log/postgresql

# Create runtime directories and non-root app user
RUN mkdir -p /app/data /app/config && \
    useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app

# Expose port (Postgres stays internal — not exposed to host)
EXPOSE 8000

# Basic container healthcheck for API readiness
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/api/health || exit 1

# entrypoint.sh starts Postgres, runs migration if needed, then execs gunicorn as appuser
ENTRYPOINT ["/app/entrypoint.sh"]
