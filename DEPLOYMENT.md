# Co-Trainer Deployment Guide (Single Image)

This project now deploys as a single Docker image that serves both:
- API routes (FastAPI)
- Frontend SPA static assets (built into the image)

Production assumptions:
- TLS/HTTPS is terminated by an external reverse proxy or hosting platform
- Database is an external PostgreSQL instance (managed service recommended)

## Prerequisites

- Docker Engine 24+
- Docker Compose plugin
- External PostgreSQL database
- Reverse proxy / platform TLS (for example: Caddy, Nginx, Traefik, Cloudflare, Render)

## 1. Configure Environment

```bash
cp .env.production.example .env.production
```

Set required values in `.env.production`:
- `DATABASE_URL` (required in production)
- `SECRET_KEY` (required)
- `NOTION_API_KEY` (optional)
- `NOTION_DATABASE_ID` (optional)

Generate a secret key:

```bash
openssl rand -hex 32
```

## 2. Build and Run (Docker Compose)

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Check status:

```bash
docker compose -f docker-compose.prod.yml ps
```

View logs:

```bash
docker compose -f docker-compose.prod.yml logs -f app
```

## 3. Health and Smoke Checks

API health endpoint:

```bash
curl http://localhost:8000/api/health
```

Frontend index endpoint:

```bash
curl -I http://localhost:8000/
```

## 4. Reverse Proxy / TLS

This container listens on port `8000`. Configure your reverse proxy to forward incoming traffic to:

- Upstream: `http://<host>:8000`

TLS certificates should be issued and renewed by your reverse proxy or hosting platform.

## 5. Update Deployment

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## 6. Stop Deployment

```bash
docker compose -f docker-compose.prod.yml down
```

## Troubleshooting

### App does not start

```bash
docker compose -f docker-compose.prod.yml logs app
```

### Database connection issues

- Verify `DATABASE_URL` format and credentials.
- Confirm database network access allows the deployment host.
- For Render/Supabase/Neon URLs that start with `postgres://`, the app auto-normalizes to `postgresql://`.

### Healthcheck failing

```bash
curl -v http://localhost:8000/api/health
```

If this fails, inspect container logs and environment values.

## Notes

- SQLite is still supported for local/dev fallback but is not recommended for production.
- Legacy multi-container frontend/nginx/certbot production topology has been removed from the active deployment path.

## CI Docker Hub Publishing

The GitHub Actions workflow builds and smoke-tests on pull requests and main pushes, then publishes to Docker Hub on successful pushes to `main`.

Configure these GitHub repository secrets:
- `DOCKERHUB_USERNAME`: your Docker Hub username
- `DOCKERHUB_TOKEN`: a Docker Hub access token with push permissions

Optional repository variable:
- `DOCKERHUB_REPOSITORY`: full repository name, for example `yourname/co-trainer`

If `DOCKERHUB_REPOSITORY` is not set, the workflow defaults to `${DOCKERHUB_USERNAME}/co-trainer`.

Published tags:
- `latest` (default branch builds)
- `sha-<short_commit>`
