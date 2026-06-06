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
# PostgreSQL major version is pinned to prevent apt resolving a newer major version
# on a future rebuild, which would make the existing cotrainer_pgdata volume unreadable.
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    gosu \
    postgresql-15 \
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
