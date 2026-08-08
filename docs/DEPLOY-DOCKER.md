# Deploy Sendell on a VPS with Docker

One always-on **Node hub** + **Postgres**. Fits long-poll remote control  
(unlike serverless-only hosts).

```text
Phone  ──HTTPS──►  VPS :8080 (Docker app)
                      │
                      ├── Postgres (sessions + messages durable)
                      │
Your PC (Grok) ──/remote-sendell──►  same VPS URL
```

---

## Prerequisites

- VPS with Docker + Docker Compose plugin  
- Ports: **8080** (or 80/443 if you put a reverse proxy)  
- Domain optional (recommended for HTTPS / clipboard on phone)

---

## 1) Clone on the VPS

```bash
git clone https://github.com/Twynzen/forge-forge-sky-cabin.git sendell
cd sendell
cp .env.example .env
nano .env   # set POSTGRES_PASSWORD + SENDELL_PUBLIC_URL
```

Example `.env`:

```env
POSTGRES_PASSWORD=use-a-long-random-password
SENDELL_PORT=8080
SENDELL_PUBLIC_URL=http://YOUR_VPS_IP:8080
```

Later with TLS:

```env
SENDELL_PUBLIC_URL=https://remote.yourdomain.com
```

---

## 2) Start

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f app
```

Open `http://YOUR_VPS_IP:8080` — you should see Sendell.

Migrations run automatically on container start (`entrypoint.sh`).

---

## 3) Firewall

```bash
# ufw example
sudo ufw allow 8080/tcp
sudo ufw allow OpenSSH
sudo ufw enable
```

---

## 4) Link Grok from your PC

1. Phone/browser → VPS URL → **Link console** → copy `/remote-sendell CODIGO`  
2. On the PC where Grok runs (same project folder):

```powershell
# one-time skill (hub = public URL of the VPS)
node path\to\sendell\scripts\install-remote-sendell.mjs --hub https://remote.yourdomain.com --project C:\path\to\project
```

In Grok:

```text
/remote-sendell CODIGO
```

Use the **same hub URL** for every project on that PC.

---

## 5) HTTPS (recommended)

Put **Caddy** or **nginx** on the VPS in front of `127.0.0.1:8080`.

Caddyfile sketch:

```text
remote.yourdomain.com {
  reverse_proxy 127.0.0.1:8080
}
```

Then set `SENDELL_PUBLIC_URL=https://remote.yourdomain.com` and recreate:

```bash
docker compose up -d
```

---

## 6) Updates (keep DB)

```bash
cd sendell
git pull
docker compose up -d --build
```

Postgres volume `sendell_pg` **keeps data** across rebuilds.

### What survives a hub restart

| Survives | Needs re-pair |
|----------|----------------|
| Session titles, rename | Live `/rc` link |
| Chat transcript in the app | Heartbeat / wait loop |
| List of past sessions | Grok process itself |

After `docker compose up -d --build`, sessions show as **offline** until you run `/remote-sendell CODIGO` again on that project.

---

## 7) Backup Postgres

```bash
docker compose exec db pg_dump -U sendell sendell > sendell-backup.sql
```

Restore:

```bash
cat sendell-backup.sql | docker compose exec -T db psql -U sendell sendell
```

---

## Local Docker (smoke test on your PC)

```bash
cp .env.example .env
# POSTGRES_PASSWORD=devpass
# SENDELL_PUBLIC_URL=http://localhost:8080
docker compose up -d --build
```

---

## Open source checklist

| Item | Status |
|------|--------|
| `Dockerfile` + `docker-compose.yml` | yes |
| `.env.example` (no secrets) | yes |
| Migrations on start | yes |
| Schema `sendell_sessions` / `sendell_messages` | yes |
| Hub persists titles + transcripts | yes |
| Live Grok on user machines | yes (subscription stays on PC) |
