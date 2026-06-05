#!/bin/sh
set -eu

SIGNAL_FILE="/var/www/certbot/.certbot-reload"
LAST_MARK=""
echo "Starting nginx certificate reload watcher"

(
  while :; do
    if [ -f "${SIGNAL_FILE}" ]; then
      MARK="$(cat "${SIGNAL_FILE}" 2>/dev/null || true)"
      if [ -n "${MARK}" ] && [ "${MARK}" != "${LAST_MARK}" ]; then
        echo "Certificate change signal detected, reloading nginx"
        nginx -s reload || true
        LAST_MARK="${MARK}"
      fi
    fi
    sleep 60
  done
) &

exit 0
