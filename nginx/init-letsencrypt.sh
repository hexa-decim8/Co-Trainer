#!/bin/sh
set -eu

if [ -z "${DOMAIN:-}" ]; then
  echo "DOMAIN is required"
  exit 1
fi

if [ -z "${LETSENCRYPT_EMAIL:-}" ]; then
  echo "LETSENCRYPT_EMAIL is required"
  exit 1
fi

STAGING_ARG=""
if [ "${LETSENCRYPT_STAGING:-0}" = "1" ]; then
  STAGING_ARG="--staging"
fi

echo "Requesting certificate for ${DOMAIN}"
docker compose --profile https run --rm certbot certonly --webroot -w /var/www/certbot \
  --email "${LETSENCRYPT_EMAIL}" \
  --agree-tos \
  --no-eff-email \
  ${STAGING_ARG} \
  -d "${DOMAIN}"

echo "Reloading nginx"
docker compose --profile https exec nginx nginx -s reload

echo "Certificate bootstrap complete"
