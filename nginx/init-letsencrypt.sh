#!/bin/bash

# Exit on error
set -e

# Load environment variables from .env.production if it exists
if [ -f ".env.production" ]; then
    export $(grep -v '^#' .env.production | xargs)
fi

# Configuration
DOMAIN=${1:-$DOMAIN}
EMAIL=${2:-$EMAIL}
STAGING=${3:-0}  # Set to 1 for testing

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo "Usage: $0 <domain> <email> [staging]"
    echo "Example: $0 example.com admin@example.com 0"
    echo ""
    echo "Or set DOMAIN and EMAIL in .env.production and run: $0"
    exit 1
fi

echo "### Initializing Let's Encrypt for $DOMAIN ..."

# Create directory for certbot challenges
mkdir -p ./certbot/www

# Download recommended TLS parameters if not present
if [ ! -e "./nginx/ssl-dhparams.pem" ]; then
  echo "### Downloading recommended TLS parameters ..."
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "./nginx/ssl-dhparams.pem"
fi

echo "### Creating dummy certificate for $DOMAIN ..."
CERT_PATH="/etc/letsencrypt/live/$DOMAIN"
mkdir -p "./certbot/conf/live/$DOMAIN"

docker-compose -f docker-compose.prod.yml run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:4096 -days 1 \
    -keyout '$CERT_PATH/privkey.pem' \
    -out '$CERT_PATH/fullchain.pem' \
    -subj '/CN=localhost'" certbot

echo "### Starting nginx ..."
docker-compose -f docker-compose.prod.yml up -d nginx

echo "### Deleting dummy certificate for $DOMAIN ..."
docker-compose -f docker-compose.prod.yml run --rm --entrypoint "\
  rm -Rf /etc/letsencrypt/live/$DOMAIN && \
  rm -Rf /etc/letsencrypt/archive/$DOMAIN && \
  rm -Rf /etc/letsencrypt/renewal/$DOMAIN.conf" certbot

echo "### Requesting Let's Encrypt certificate for $DOMAIN ..."

# Select appropriate email arg
case "$EMAIL" in
  "") email_arg="--register-unsafely-without-email" ;;
  *) email_arg="--email $EMAIL" ;;
esac

# Enable staging mode if needed
staging_arg=""
if [ $STAGING != "0" ]; then 
    staging_arg="--staging"
    echo "### STAGING MODE - This is a test certificate ###"
fi

docker-compose -f docker-compose.prod.yml run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $staging_arg \
    $email_arg \
    -d $DOMAIN \
    --rsa-key-size 4096 \
    --agree-tos \
    --non-interactive \
    --force-renewal" certbot

echo "### Reloading nginx ..."
docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload

echo ""
echo "### SUCCESS! ###"
echo "Certificate obtained for $DOMAIN"
if [ $STAGING != "0" ]; then
    echo ""
    echo "This was a STAGING certificate (for testing)"
    echo "To get a real certificate, run:"
    echo "  $0 $DOMAIN $EMAIL 0"
fi
echo ""
echo "Your site should now be available at: https://$DOMAIN"
