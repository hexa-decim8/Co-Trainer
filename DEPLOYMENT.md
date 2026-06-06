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
- Public DNS A/AAAA record pointing your domain to this host
- Open inbound ports 80 and 443 on your firewall/security group

## 1. Configure Environment

```bash
cp .env.production.example .env.production
```

Set required values in `.env.production`:
- `SECRET_KEY` (required)
- `NOTION_API_KEY` (optional)
- `NOTION_DATABASE_ID` (optional)
- `DOMAIN` (required for Let's Encrypt issuance)
- `LETSENCRYPT_EMAIL` (required)
- `LETSENCRYPT_STAGING` (`1` for staging test certs, `0` for production certs)

Generate a secret key:

```bash
openssl rand -hex 32
```

## 2. Build and Start Services

```bash
docker compose --profile https up -d --build
```

This starts:
- `cotrainer` on internal port 8000
- `nginx` on ports 80 and 443
- `certbot` renewal loop (runs every 12 hours)

For the first boot, nginx generates a temporary self-signed certificate so port 443 can start before Let's Encrypt issuance.

## 3. Issue the First Let's Encrypt Certificate

Run initial certificate bootstrap once after the services are up:

```bash
sh nginx/init-letsencrypt.sh
```

The script requests a cert using webroot challenge and reloads nginx.

If you are testing and want staging certs first:

```bash
LETSENCRYPT_STAGING=1 sh nginx/init-letsencrypt.sh
```

Check status:

```bash
docker compose ps
```

View logs:

```bash
docker compose --profile https logs -f cotrainer nginx certbot
```

## 4. Health and Smoke Checks

API health endpoint:

```bash
curl http://localhost/api/health
```

Frontend index endpoint:

```bash
curl -I http://localhost/
```

HTTPS certificate check:

```bash
curl -Iv https://ameri.boo/
```

## 5. Reverse Proxy / TLS

Nginx listens on ports `80` and `443` and forwards traffic to:

- Upstream: `http://cotrainer:8000`

Let's Encrypt certificates are stored in the `letsencrypt` Docker volume and renewed by the `certbot` service.

To validate renewal behavior manually:

```bash
docker compose --profile https run --rm certbot renew --dry-run --webroot -w /var/www/certbot
```

## 6. Update Deployment

```bash
git pull
docker compose up -d --build
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
