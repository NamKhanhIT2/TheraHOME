#!/usr/bin/env bash
# Local/manual database backup for Supabase Free (no managed backups).
# Encrypts the dump so it is safe to store anywhere.
#
# Prereqs (once):  brew install libpq gnupg   # then add libpq to PATH:
#   echo 'export PATH="/opt/homebrew/opt/libpq/bin:$PATH"' >> ~/.zshrc && exec zsh
#
# Env:
#   SUPABASE_DB_URL     Dashboard → Connect → "Session pooler" URI (password included)
#   BACKUP_PASSPHRASE   (optional) if set, the dump is GPG/AES-256 encrypted
#   KEEP                (optional) how many backups to retain, default 14
#
# Run:
#   SUPABASE_DB_URL='postgresql://...' BACKUP_PASSPHRASE='...' ./scripts/backup-db.sh
#
# Restore:
#   gpg -d backups/db-XXXX.dump.gpg > db.dump          # if encrypted
#   pg_restore --clean --if-exists -d "$SUPABASE_DB_URL" db.dump
set -euo pipefail

: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL (Session pooler URI from the dashboard)}"
KEEP="${KEEP:-14}"
DIR="$(cd "$(dirname "$0")/.." && pwd)/backups"
mkdir -p "$DIR"
STAMP="$(date -u +%Y%m%d-%H%M)"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump not found. Install with:  brew install libpq  (then add its bin to PATH)"; exit 1
fi

if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
  OUT="$DIR/db-${STAMP}.dump.gpg"
  pg_dump -Fc --no-owner --no-privileges "$SUPABASE_DB_URL" \
    | gpg --batch --yes --symmetric --cipher-algo AES256 --passphrase "$BACKUP_PASSPHRASE" -o "$OUT"
else
  OUT="$DIR/db-${STAMP}.dump"
  pg_dump -Fc --no-owner --no-privileges "$SUPABASE_DB_URL" -f "$OUT"
  echo "NOTE: unencrypted dump (BACKUP_PASSPHRASE not set) — contains user PII."
fi

ls -lh "$OUT"

# Prune old backups, keep the newest $KEEP.
ls -1t "$DIR"/db-* 2>/dev/null | tail -n +"$((KEEP + 1))" | while read -r old; do
  echo "pruning $old"; rm -f "$old"
done
