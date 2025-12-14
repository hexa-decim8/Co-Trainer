# Co-Trainer Production Deployment Guide

This guide walks you through deploying Co-Trainer with Docker and HTTPS.

## Prerequisites

- A Linux server (Ubuntu 20.04+ recommended)
- Docker and Docker Compose installed
- A domain name pointing to your server's IP address
- Ports 80 and 443 open on your firewall

## Quick Start

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin

# Log out and back in for group changes to take effect
```

### 2. Clone Repository

```bash
git clone https://github.com/hexa-decim8/Co-Trainer.git
cd Co-Trainer
```

### 3. Configure Environment

```bash
# Copy example environment file
cp .env.production.example .env.production

# Edit with your settings
nano .env.production
```

Update these values:
- `DOMAIN`: Your domain name (e.g., cotrainer.example.com)
- `EMAIL`: Your email for Let's Encrypt notifications
- `POSTGRES_PASSWORD`: Strong database password
- `SECRET_KEY`: Generate with `openssl rand -hex 32`
- `NOTION_API_KEY`: Your Notion integration API key
- `NOTION_DATABASE_ID`: Your Notion database ID

### 4. DNS Configuration

Point your domain to your server:
```
A Record: @ -> YOUR_SERVER_IP
A Record: www -> YOUR_SERVER_IP
```

Wait for DNS propagation (usually 5-30 minutes).

### 5. Initialize SSL Certificate

```bash
# Make script executable
chmod +x nginx/init-letsencrypt.sh

# Test with staging certificate first (recommended)
./nginx/init-letsencrypt.sh your-domain.com your-email@example.com 1

# If successful, get production certificate
./nginx/init-letsencrypt.sh your-domain.com your-email@example.com 0
```

### 6. Launch Application

```bash
# Build and start all services
docker-compose -f docker-compose.prod.yml up -d --build

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

Your application should now be running at `https://your-domain.com`!

## Management Commands

### View Logs
```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend
docker-compose -f docker-compose.prod.yml logs -f nginx
```

### Restart Services
```bash
# Restart all
docker-compose -f docker-compose.prod.yml restart

# Restart specific service
docker-compose -f docker-compose.prod.yml restart backend
```

### Update Application
```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose -f docker-compose.prod.yml up -d --build

# Or rebuild specific service
docker-compose -f docker-compose.prod.yml up -d --build backend
```

### Stop Application
```bash
# Stop all services (keeps data)
docker-compose -f docker-compose.prod.yml down

# Stop and remove volumes (deletes data!)
docker-compose -f docker-compose.prod.yml down -v
```

## Database Management

### Backup Database
```bash
# Create backup
docker exec cotrainer-postgres pg_dump -U cotrainer cotrainer > backup_$(date +%Y%m%d_%H%M%S).sql

# Compress backup
gzip backup_*.sql
```

### Restore Database
```bash
# Restore from backup
gunzip -c backup_20241212_120000.sql.gz | docker exec -i cotrainer-postgres psql -U cotrainer cotrainer
```

### Access Database Console
```bash
docker exec -it cotrainer-postgres psql -U cotrainer cotrainer
```

## Monitoring

### Check Service Health
```bash
# Check all containers
docker-compose -f docker-compose.prod.yml ps

# Check specific container
docker inspect cotrainer-backend --format='{{.State.Health.Status}}'
```

### Monitor Resource Usage
```bash
# Real-time stats
docker stats

# Container logs size
docker-compose -f docker-compose.prod.yml logs --tail=1000 | wc -l
```

### SSL Certificate Status
```bash
# Check certificate expiry
docker-compose -f docker-compose.prod.yml run --rm certbot certificates
```

## Troubleshooting

### Application Won't Start
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs

# Check specific service
docker-compose -f docker-compose.prod.yml logs backend

# Verify environment variables
docker-compose -f docker-compose.prod.yml config
```

### SSL Certificate Issues
```bash
# Check nginx config
docker-compose -f docker-compose.prod.yml exec nginx nginx -t

# Reload nginx
docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload

# Re-run certificate initialization
./nginx/init-letsencrypt.sh your-domain.com your-email@example.com 0
```

### Database Connection Issues
```bash
# Check database is running
docker-compose -f docker-compose.prod.yml ps postgres

# Check database logs
docker-compose -f docker-compose.prod.yml logs postgres

# Verify connection from backend
docker-compose -f docker-compose.prod.yml exec backend python -c "from database import engine; print(engine)"
```

### Port Already in Use
```bash
# Find process using port 80/443
sudo lsof -i :80
sudo lsof -i :443

# Stop conflicting service
sudo systemctl stop apache2  # or nginx, etc.
```

## Security Best Practices

1. **Keep secrets secure**: Never commit `.env.production` to git
2. **Regular updates**: Update Docker images regularly
   ```bash
   docker-compose -f docker-compose.prod.yml pull
   docker-compose -f docker-compose.prod.yml up -d
   ```
3. **Firewall**: Only allow ports 80, 443, and SSH
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```
4. **Backups**: Set up automated database backups
5. **Monitoring**: Set up log monitoring and alerts

## Performance Tuning

### Reduce Memory Usage
Edit `docker-compose.prod.yml`:
```yaml
backend:
  deploy:
    resources:
      limits:
        memory: 512M
      reservations:
        memory: 256M
```

### Scale Workers
```yaml
backend:
  command: gunicorn main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker
```

## Support

For issues or questions:
- Check logs: `docker-compose -f docker-compose.prod.yml logs`
- Review this guide
- Check GitHub issues: https://github.com/hexa-decim8/Co-Trainer/issues

## License

See LICENSE file in repository.
