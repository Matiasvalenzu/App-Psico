#!/bin/bash
# Backup cifrado de Psiconex. Se ejecuta en el host del VPS, desde el checkout:
#   cd /srv/psiconex-docker/current && BACKUP_GPG_RECIPIENT=<clave> docker/scripts/backup.sh
# Requiere en el host gpg con la clave pública importada (la privada se guarda
# fuera del VPS). Cron diario sugerido (crontab -e de root):
#   17 3 * * * cd /srv/psiconex-docker/current && BACKUP_GPG_RECIPIENT=<clave> docker/scripts/backup.sh >> /var/log/psiconex-backup.log 2>&1
#
# - Incluye PostgreSQL, los adjuntos (MEDIA_ROOT) y los PDF y capturas de las
#   boletas (/data/bhe). No incluye audio: se elimina tras transcribir.
# - Todo se cifra con GPG en el mismo pipe: nada queda en claro en disco.
# - Conserva BACKUP_RETENCION_DIAS (30 por defecto) días de backups.
set -euo pipefail

: "${BACKUP_GPG_RECIPIENT:?BACKUP_GPG_RECIPIENT es obligatorio: los backups siempre van cifrados}"
BACKUP_DIR="${BACKUP_DIR:-/srv/psiconex-docker/backups/diarios}"
RETENCION_DIAS="${BACKUP_RETENCION_DIAS:-30}"
COMPOSE=(docker compose -p psiconex -f docker-compose.prod.yml)
DESTINO="${BACKUP_DIR}/psiconex_$(date +%Y%m%d_%H%M%S)"

cifrar() {
  gpg --batch --yes --trust-model always --encrypt --recipient "$BACKUP_GPG_RECIPIENT" --output "$1"
}

umask 077
mkdir -p "$DESTINO"
trap 'echo "Backup incompleto: se elimina $DESTINO" >&2; rm -rf "$DESTINO"' ERR

echo "==> PostgreSQL"
"${COMPOSE[@]}" exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  | gzip | cifrar "${DESTINO}/database.sql.gz.gpg"

echo "==> Adjuntos"
if "${COMPOSE[@]}" exec -T backend test -d /app/media; then
  "${COMPOSE[@]}" exec -T backend tar -cz -C /app media | cifrar "${DESTINO}/media.tar.gz.gpg"
fi

echo "==> Boletas"
if "${COMPOSE[@]}" exec -T backend test -d /data/bhe; then
  "${COMPOSE[@]}" exec -T backend tar -cz -C /data bhe | cifrar "${DESTINO}/bhe.tar.gz.gpg"
fi

echo "==> Rotación (${RETENCION_DIAS} días)"
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name 'psiconex_*' -mtime "+${RETENCION_DIAS}" \
  -exec rm -rf {} +

echo "Backup generado: $DESTINO"
