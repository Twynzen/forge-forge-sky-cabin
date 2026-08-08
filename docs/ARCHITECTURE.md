# Sendell Remote Control — Architecture

## Product model (read this first)

**Primary:** Link **already-open agent consoles** authenticated via **subscription / OAuth** (e.g. `grok` CLI).  
The phone PWA never needs the provider API key for this path.

**Secondary (kept for later):** API-key / headless agent attach for automation, CI, or providers that only expose keys. ACP client code and bridge env hooks remain available — not removed.

```
Phone PWA  ──pair/chat──►  Sendell Hub  ◄──bridge──  sendell-bridge  ──►  grok (OAuth session)
```

---

## Pairing

1. **Phone creates room** → 6-char pairing code  
2. **OR terminal prints code** after `/remote` → phone enters it  
3. Bridge on the agent machine:  
   `node scripts/sendell-bridge.mjs --code XXXXXX --hub <url>`  
4. Hub marks session `linkState: linked`  
5. Prompts queue to the bridge; stream events push back; tool permissions surface on the phone  

Codes: `src/lib/hub/pairing.ts`  
Bridge registry / queues: `src/lib/hub/bridge-registry.ts`  
Hub: `src/lib/hub/hub.ts`

### Bridge HTTP API

| Endpoint | Role |
| --- | --- |
| `POST /api/bridge/pair` | Claim code → `sessionToken` |
| `GET /api/bridge/commands?token=` | Long-poll phone commands |
| `POST /api/bridge/events` | Push stream (messages, tools, plan) |
| `POST /api/bridge/heartbeat` | Keep link alive |

---

## Layers

| Layer | Path | Notes |
| --- | --- | --- |
| PWA UI | `src/components/sendell/*` | Link dialog, chat, permissions |
| Server fns (phone) | `src/lib/api/hub-api.ts` | No secrets |
| Hub | `src/lib/hub/hub.ts` | Rooms, link state, demo console |
| Demo console | `src/lib/hub/demo-console.ts` | Preview without real machine |
| ACP core | `src/lib/hub/acp/*` | For real stdio attach (now + API-key later) |
| Bridge CLI | `scripts/sendell-bridge.mjs` | Runs next to subscription CLI |

---

## Auth boundaries

| Secret | Where it lives |
| --- | --- |
| Provider subscription / OAuth | Agent terminal (`grok`, etc.) |
| Pairing code | Short-lived, shown to user |
| Bridge `sessionToken` | Only on the bridge process |
| API key (optional later) | Bridge env / headless mode only — **not** in the phone app |

---

## Vision: `/remote` in the TUI

Ideal: user types `/remote` inside Grok Build → code/QR → phone joins.  
Until native support, `sendell-bridge` is the external adapter.

---

## Secondary path: API keys (not default)

Kept for future automation:

- Bridge can spawn ACP via `SENDELL_GROK_ACP_CMD` / `SENDELL_GROK_ACP_ARGS`
- `XAI_API_KEY` only on the **machine running the agent**, never required by the PWA
- UI should continue to lead with “link console”, not “paste API key”

---

## Roadmap

1. Native `/remote` in Grok Build  
2. Claude / Gemini / Codex console bridges  
3. QR + deep links  
4. Optional API-key automation mode in UI (advanced)  
5. SSE/WebSocket push  
6. Session persistence + multi-user  
7. **Docker / VPS self-host** — see [DEPLOY-DOCKER.md](./DEPLOY-DOCKER.md)  
