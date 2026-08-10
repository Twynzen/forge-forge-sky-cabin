# Sendell Remote Control — single long-running Node hub (Docker / VPS)
#
#   docker compose up -d --build
#
# Requires DATABASE_URL at runtime (compose sets it).

FROM node:22-bookworm-slim AS build
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# Exact versions from committed package-lock.json only (no floating resolve)
RUN npm ci

COPY . .

# Node server preset (long-poll friendly). Do NOT migrate at build time.
ENV NITRO_PRESET=node-server
ENV DATABASE_URL=
RUN npm run build:docker

FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080
ENV SENDELL_MEDIA_DIR=/data/media

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl \
  && rm -rf /var/lib/apt/lists/* \
  && useradd -r -u 1001 sendell \
  && mkdir -p /data/media \
  && chown -R sendell:sendell /data

COPY --from=build /app/.output ./.output
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/migrations ./migrations
# pg for migrate.mjs (production deps only)
COPY --from=build /app/node_modules ./node_modules
COPY docker/entrypoint.sh /entrypoint.sh

# entrypoint runs as root briefly to fix volume ownership, then drops to sendell
RUN chmod +x /entrypoint.sh && chown -R sendell:sendell /app

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD curl -sf http://127.0.0.1:8080/ > /dev/null || exit 1

ENTRYPOINT ["/entrypoint.sh"]
