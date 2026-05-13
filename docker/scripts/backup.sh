#!/bin/bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
WORKDIR="${BACKUP_DIR}/psicologo_${TIMESTAMP}"
ARCHIVE="${WORKDIR}.tar.gz"

mkdir -p "$WORKDIR"

echo "==> Exportando PostgreSQL..."
PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
  -h "${POSTGRES_HOST:-db}" \
  -U "${POSTGRES_USER:-psicologo}" \
  -d "${POSTGRES_DB:-psicologo}" \
  > "${WORKDIR}/database.sql"

echo "==> Copiando audios..."
if [ -d "${AUDIO_STORAGE_PATH:-/data/audio}" ]; then
  cp -a "${AUDIO_STORAGE_PATH:-/data/audio}" "${WORKDIR}/audio"
fi

echo "==> Comprimiendo backup..."
tar -czf "$ARCHIVE" -C "$BACKUP_DIR" "$(basename "$WORKDIR")"
rm -rf "$WORKDIR"

if [ -n "${BACKUP_GPG_RECIPIENT:-}" ]; then
  echo "==> Encriptando backup con GPG..."
  gpg --yes --encrypt --recipient "$BACKUP_GPG_RECIPIENT" "$ARCHIVE"
  rm -f "$ARCHIVE"
  ARCHIVE="${ARCHIVE}.gpg"
fi

echo "Backup generado: $ARCHIVE"
