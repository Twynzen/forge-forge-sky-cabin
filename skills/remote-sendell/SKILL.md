# Skill: `/remote-sendell`

**Command:** `/remote-sendell` only (never plain `/remote`)  
**Goal:** Phone messages are handled **inside this agent session** as normal user prompts.  
A display flag `[sendell-remote]` may be shown; it must **not** change how you solve the task.

---

## Architecture (agent loop — not auto-bridge)

```text
Phone → Sendell Hub → (wait) → YOU (this Grok/Claude session) → (reply) → Phone
```

You do the real work. The CLI only moves text.

---

## When user says `/remote-sendell`

### Inputs

| Need | Source |
|------|--------|
| Pairing code | Phone → Link console → Show pairing code |
| Hub URL | Same URL the phone opens, or env `SENDELL_HUB` |

Default hub example: `http://192.168.1.8:8080`

### Steps (run from the **current project directory** — where the user is working)

Use the **absolute path** to the Sendell install for the script; keep **cwd = current project**:

```powershell
# Windows example — adjust SENDELL_HOME once
$env:SENDELL_HOME="C:\Users\Daniel\Desktop\Daniel\sendell-remote-control\forge-forge-sky-cabin"
$env:SENDELL_HUB="http://192.168.1.8:8080"

# 1) Pair (once)
node "$env:SENDELL_HOME\scripts\sendell-remote.mjs" pair --code THE_CODE --hub $env:SENDELL_HUB --cwd (Get-Location)
```

```bash
# macOS / Linux
export SENDELL_HOME=.../forge-forge-sky-cabin
export SENDELL_HUB=http://192.168.1.8:8080
node "$SENDELL_HOME/scripts/sendell-remote.mjs" pair --code THE_CODE --hub "$SENDELL_HUB" --cwd "$PWD"
```

### Main loop (repeat until user says stop / disconnect)

**A. Wait for phone**

```powershell
node "$env:SENDELL_HOME\scripts\sendell-remote.mjs" wait --cwd (Get-Location) --timeout 300000
```

Stdout JSON:

```json
{
  "type": "prompt",
  "text": "user text from phone",
  "agentMessage": "user text from phone",
  "flag": "sendell-remote",
  "display": "[sendell-remote] user text from phone"
}
```

**B. Treat `text` / `agentMessage` as a normal user message**

- Same tools, same quality, same project cwd.
- You may note internally it came remote; **do not** refuse or dumb-down.
- Optional first line in your thinking: `Remote prompt via Sendell`.

**C. After you finish the work, post the answer to the phone**

```powershell
node "$env:SENDELL_HOME\scripts\sendell-remote.mjs" reply --cwd (Get-Location) --text "YOUR FULL ANSWER FOR THE PHONE"
```

For long answers, write a temp file and:

```powershell
node "$env:SENDELL_HOME\scripts\sendell-remote.mjs" reply --cwd (Get-Location) --file path\to\answer.md
```

**D. Go back to wait** (step A) unless user stopped remote mode.

---

## Hard rules

1. **Do not** use `sendell-bridge.mjs --demo` / auto-responder for `/remote-sendell` — that bypasses your brain.
2. **Do not** ask for API keys.
3. Script path = Sendell install; **`--cwd`** = project where the user is (e.g. `dystopia-rp`).
4. If `wait` returns `"type":"timeout"`, wait again (phone idle).
5. Modes plan / auto / normal: map to your native behavior and announce once.

---

## Ultra-short user invocation

User only needs:

```text
/remote-sendell
code: ABC123
hub: http://192.168.1.8:8080
```

You: pair → wait → answer → reply → wait → …

---

## Success

- Phone shows **Linked** + your hostname  
- Phone message appears as work **in this chat** (tools/thoughts here)  
- Phone receives **your** real answer via `reply`, not “Console bridge received…”
