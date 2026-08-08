#!/bin/sh
set -eu

echo "[sendell] starting…"

if [ -n "${DATABASE_URL:-}" ]; then
  echo "[sendell] waiting for database…"
  # simple retry loop (no extra packages)
  i=0
  until node -e "
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
  node scripts/migrate.mjs
else
  echo "[sendell] WARNING: DATABASE_URL unset — PGLite fallback / no durable sessions"
fi

echo "[sendell] hub on 0.0.0.0:${PORT:-8080}"
# Nitro node-server entry
exec node .output/server/index.mjs
