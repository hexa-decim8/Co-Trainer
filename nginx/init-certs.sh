#!/bin/sh
set -eu

if [ -z "${DOMAIN:-}" ]; then
  echo "DOMAIN is not set; skipping temporary certificate bootstrap"
  exit 0
fi

CERT_PATH="/etc/letsencrypt/live/${DOMAIN}"
PRIVKEY_FILE="${CERT_PATH}/privkey.pem"
FULLCHAIN_FILE="${CERT_PATH}/fullchain.pem"

if [ -f "${PRIVKEY_FILE}" ] && [ -f "${FULLCHAIN_FILE}" ]; then
  echo "Using existing certificate for ${DOMAIN}"
  exit 0
fi

echo "No Let's Encrypt certificate found for ${DOMAIN}. Creating temporary self-signed certificate so nginx can start."
mkdir -p "${CERT_PATH}"
openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
  -keyout "${PRIVKEY_FILE}" \
  -out "${FULLCHAIN_FILE}" \
  -subj "/CN=${DOMAIN}" >/dev/null 2>&1

echo "Temporary certificate created for ${DOMAIN}"
