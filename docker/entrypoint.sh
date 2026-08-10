#!/bin/sh
set -eu

echo "[sendell] starting…"

MEDIA_DIR="${SENDELL_MEDIA_DIR:-/data/media}"
mkdir -p "$MEDIA_DIR"
# Named volumes often mount as root — fix so uid 1001 can write screenshots/uploads
if [ "$(id -u)" = "0" ]; then
  chown -R sendell:sendell "$MEDIA_DIR" 2>/dev/null || true
  chown -R sendell:sendell /app 2>/dev/null || true
fi

run_as_sendell() {
  if [ "$(id -u)" = "0" ]; then
    if command -v runuser >/dev/null 2>&1; then
      exec runuser -u sendell -- "$@"
    fi
    exec su -s /bin/sh sendell -c "$*"
  fi
  exec "$@"
}

if [ -n "${DATABASE_URL:-}" ]; then
  echo "[sendell] waiting for database…"
  i=0
  until runuser -u sendell -- node -e "
    const pg=require('pg');
    const p=new pg.Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:3000,max:1});
    p.query('select 1').then(()=>{p.end();process.exit(0)}).catch(()=>{p.end();process.exit(1)});
  " 2>/dev/null; do
    i=$((i + 1))
    if [ "$i" -ge 40 ]; then
      echo "[sendell] database not reachable after ~80s" >&2
      exit 1
    fi
    sleep 2
  done
  echo "[sendell] running migrations…"
  if [ "$(id -u)" = "0" ]; then
    runuser -u sendell -- node scripts/migrate.mjs
  else
    node scripts/migrate.mjs
  fi
else
  echo "[sendell] WARNING: DATABASE_URL unset — PGLite fallback / no durable sessions"
fi

echo "[sendell] media dir: $MEDIA_DIR"
echo "[sendell] hub on 0.0.0.0:${PORT:-8080}"
run_as_sendell node .output/server/index.mjs
