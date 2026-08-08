# Sendell Remote Control

**Link live agent consoles (subscription / OAuth) to your phone.**

You run `grok` (or another agent) on a laptop/VPS with your normal login.  
Sendell attaches to that session so you can chat and approve tools from anywhere.

> **Primary path:** subscription console linking (no API key in the app).  
> **Secondary (kept for later):** API-key / headless automation via the bridge.

---

## How it works

```
Phone  ↔  Sendell Hub  ↔  sendell-bridge  ↔  open grok session (OAuth)
```

1. Open the PWA → **Link console**
2. Phone shows a **pairing code** (or you enter a code from the terminal)
3. On the machine with the agent already logged in:

```bash
node scripts/sendell-bridge.mjs --code ABC123 --hub https://your-app-url
```

4. Chat from the phone; tool calls wait for your approval.

Demo in the preview: **Try demo console** (same UX, simulated linked session).

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | App on port 8080 |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript |
| `node scripts/sendell-bridge.mjs --code …` | Link a real/demo console |

---

## Optional: API key / ACP on the bridge (secondary)

Not required for the product path. For later automation or when the bridge spawns ACP:

```bash
export XAI_API_KEY=…          # only on the agent machine
export SENDELL_GROK_ACP_CMD=grok
export SENDELL_GROK_ACP_ARGS=acp
node scripts/sendell-bridge.mjs --code ABC123 --hub …
```

The phone UI still never stores that key.

---

## Docs

- In-app: `/docs`
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

---

## Stack

TanStack Start · React 19 · Zustand · ACP-ready bridge · PWA

---

## Docker / VPS (self-host)

Run a **single always-on Node hub + Postgres** (best for remote long-poll):

```bash
cp .env.example .env   # set POSTGRES_PASSWORD + SENDELL_PUBLIC_URL
docker compose up -d --build
```

Full guide: [docs/DEPLOY-DOCKER.md](./docs/DEPLOY-DOCKER.md)

On your agent machine, point the skill at the public URL:

```bash
node scripts/install-remote-sendell.mjs --hub https://your-vps-or-domain --project /path/to/project
```

Then in Grok: `/remote-sendell CODIGO`
