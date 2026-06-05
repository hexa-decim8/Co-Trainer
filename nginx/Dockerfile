FROM nginx:1.27-alpine

RUN apk add --no-cache openssl

COPY init-certs.sh /docker-entrypoint.d/99-init-certs.sh
COPY auto-reload.sh /docker-entrypoint.d/98-auto-reload.sh
RUN chmod +x /docker-entrypoint.d/99-init-certs.sh /docker-entrypoint.d/98-auto-reload.sh
