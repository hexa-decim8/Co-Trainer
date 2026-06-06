# Co-Trainer Deployment Guide (Single Image)

This project now deploys as a single Docker image that serves both:
- API routes (FastAPI)
- Frontend SPA static assets (built into the image)

Production assumptions:
- TLS/HTTPS is terminated by an in-container Nginx reverse proxy with Let's Encrypt Certbot
- Database is an embedded PostgreSQL instance that runs inside the container

## Prerequisites

- Docker Engine 24+
- Docker Compose plugin
- (Optional) SWAG reverse proxy already running with TLS, or in-container nginx+certbot for TLS

## Deployment Options

### A. With External Reverse Proxy (SWAG, Traefik, etc.)

Use this if you already have a reverse proxy handling TLS termination.

**1. Configure Environment**

```bash
cp .env.production.example .env.production
```

Set required values in `.env.production`:
- `SECRET_KEY` (required) — generate with `openssl rand -hex 32`
- `APP_URL` (required) — public HTTPS URL, e.g., `https://ameri.boo`
- `CORS_ALLOW_ORIGINS` (optional) — comma-separated list; leave empty to use `APP_URL`
- `DEBUG` (`false` in production)
- `NOTION_API_KEY` (optional)
- `NOTION_DATABASE_ID` (optional)

**2. Start Application**

```bash
docker compose up -d --build
```

That's it. SWAG handles TLS + renewal. Backend runs on internal port 8000, SWAG proxies HTTPS traffic to it.

**3. Configure SWAG Proxy**

Add to SWAG's proxy-confs:

```nginx
# /config/nginx/proxy-confs/co-trainer.subdomain.conf
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name cotrainer.*;

    include /config/nginx/ssl.conf;

    # Security headers (recommended)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;

    location / {
        proxy_pass http://cotrainer:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# HTTP redirect
server {
    listen 80;
    listen [::]:80;
    server_name cotrainer.*;
    location / {
        return 301 https://$host$request_uri;
    }
}
```

Also update your SWAG environment to include `cotrainer` in SUBDOMAINS:

```yaml
- SUBDOMAINS=audiobookshelf,cotrainer
```

Then reload SWAG for the new proxy config to take effect.

**4. Health Check**

```bash
curl https://cotrainer.ameri.boo/api/health
```

### B. With In-Container TLS (nginx + Certbot)

Use this if you want TLS managed entirely within this container.

**1. Configure Environment**

```bash
cp .env.production.example .env.production
```

Set required values in `.env.production`:
- `SECRET_KEY` (required)
- `APP_URL` (required)
- `DEBUG` (`false`)
- `DOMAIN` (required) — your domain for Let's Encrypt
- `LETSENCRYPT_EMAIL` (required)
- `LETSENCRYPT_STAGING` (`1` for testing, `0` for production)

Important: `docker compose` reads `.env` by default, not `.env.production`.
Use `--env-file .env.production` for all deployment commands, or copy `.env.production` to `.env`.

**2. Build and Start Services**

```bash
docker compose --env-file .env.production --profile https up -d --build
```

This starts cotrainer, nginx, and certbot renewal loop.

**3. Issue the First Let's Encrypt Certificate**

```bash
set -a && . ./.env.production && set +a
sh nginx/init-letsencrypt.sh
```

Check status:

```bash
docker compose --env-file .env.production --profile https logs -f nginx certbot
```

Expected output: `Successfully received certificate`

**4. Health Checks**

```bash
curl http://localhost/api/health       # HTTP (redirects to HTTPS)
curl -Iv https://yourdomain.com/api/health
```

**5. Monitor Renewal**

```bash
docker compose --env-file .env.production --profile https logs certbot
# Should show "renew" activity every 12h
```

---

## Common Tasks

### Update Deployment

**Option A (SWAG):**
```bash
git pull
docker compose up -d --build
# SWAG proxy already in place, no additional steps
```

**Option B (In-container TLS):**
```bash
git pull
docker compose --env-file .env.production --profile https up -d --build
```

### Check Certificate Status (In-container TLS Only)

```bash
# Expiry date
docker compose --env-file .env.production --profile https exec nginx openssl x509 \
  -in /etc/letsencrypt/live/${DOMAIN}/fullchain.pem -noout -enddate

# Issuer
docker compose --env-file .env.production --profile https exec nginx openssl x509 \
  -in /etc/letsencrypt/live/${DOMAIN}/fullchain.pem -noout -issuer
```

### Manual Cert Renewal Test (In-container TLS Only)

```bash
docker compose --env-file .env.production --profile https run --rm certbot renew \
  --dry-run --webroot -w /var/www/certbot
```


## Data Persistence During Updates

For local/single-container Docker Compose usage (`docker-compose.yml`), Co-Trainer stores state in named volumes:

- `cotrainer_pgdata` mounted at `/var/lib/postgresql/data` (PostgreSQL data directory)
- `cotrainer_config` mounted at `/app/config` (encrypted settings and JWT secret key)

> **CRITICAL:** Never run `docker compose down -v` unless you intentionally want to
> **delete all user accounts and saved data**. The `-v` flag removes named volumes.
> Use `docker compose down` (without `-v`) to stop services while keeping data intact.

Safe update flow (preserves users and auth state):

```bash
docker compose pull
docker compose up -d
```

or

```bash
docker compose up -d --build
```

Important reset caveat:

- `docker compose down` preserves volumes — **safe, use this**
- `docker compose down -v` **removes volumes and permanently deletes all data**
- `docker system prune --volumes` also removes unused volumes — **avoid this**

### Automatic Backups

Set `PG_AUTO_BACKUP=1` in your environment to automatically dump the database to
`/app/config/backups/` on every container start (before the app launches). The 5
most recent backups are kept; older ones are pruned automatically.

```bash
# In .env.production or docker-compose.yml environment section:
PG_AUTO_BACKUP=1
```

Backups are stored in the `cotrainer_config` volume and survive container rebuilds.

### Manual Backup and Restore

Recommended before major updates:

```bash
# Backup
docker compose exec -T cotrainer pg_dump -U cotrainer -d cotrainer > cotrainer-backup.sql

# Restore
docker compose exec -T cotrainer psql -U cotrainer -d cotrainer < cotrainer-backup.sql
```

### Persistence Verification

Run these checks before and after updates to confirm data survived:

```bash
# 1) Verify the data volume exists
docker volume ls | grep cotrainer_pgdata

# 2) Verify the container is mounted to the expected data volume
docker inspect cotrainer --format '{{ json .Mounts }}'

# 3) Verify users exist at the database layer
docker compose exec cotrainer psql -U cotrainer -d cotrainer \
  -c "SELECT COUNT(*) AS users FROM auth.users;"

# 4) Check startup logs for user count (should be > 0)
docker compose logs cotrainer 2>&1 | grep 'Startup DB diagnostics'
```

### PostgreSQL Version Mismatch

Co-Trainer embeds PostgreSQL 17 inside the container. The data volume is formatted
for this specific major version. If a future image change installs a different PG
major version (e.g., 18), the container will **refuse to start** and print:

```
[entrypoint] FATAL: PostgreSQL version mismatch!
  Installed binary version : 18
  Data directory version   : 17
```

**This is intentional** — it prevents silent data loss. To upgrade PostgreSQL:

1. With the **old** image still running, back up:
   ```bash
   docker compose exec -T cotrainer pg_dump -U cotrainer -d cotrainer > cotrainer-backup.sql
   ```
2. Stop and remove the old volume:
   ```bash
   docker compose down -v
   ```
3. Start fresh with the new image:
   ```bash
   docker compose up -d
   ```
4. Restore data:
   ```bash
   docker compose exec -T cotrainer psql -U cotrainer -d cotrainer < cotrainer-backup.sql
   ```

## 7. Stop Deployment

```bash
docker compose down
```

## Troubleshooting

### App does not start

```bash
docker compose logs cotrainer
```

### Healthcheck failing

```bash
curl -v http://localhost/api/health
```

If this fails, inspect container logs and environment values.

### Let's Encrypt challenge failures

- Verify DNS for `DOMAIN` points to this host.
- Verify inbound port 80 is reachable from the public internet.
- Ensure no other service is bound to ports 80 or 443.
- Check certbot logs:

```bash
docker compose logs certbot
```

## Notes

- The embedded PostgreSQL data persists across container restarts in the `cotrainer_pgdata` volume. Use `docker compose down -v` only if you intend to wipe all data.

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
