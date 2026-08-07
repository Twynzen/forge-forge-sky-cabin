# Skill: `/remote-sendell`

**Command:** `/remote-sendell` only  

## UX contract (like Cloudy /rc)

When remote is on:

- **Do NOT** print or narrate: “waiting for phone”, “loop started”, “pair OK”, “timeout, retrying”, “reinicio wait”, etc.
- **Do NOT** dump long status tables in the chat.
- Run `pair` / `wait` / `reply` as **quiet tools**. Prefer background wait.
- In the TUI, the only visible signal should feel like a small **`/rc`** (remote active). If you must say one line after pair: `rc on` — nothing more.
- When a phone prompt arrives, treat `text` as a **normal user message** and do the work. Tag `[sendell-remote]` is metadata only — **same quality**.
- After work, `reply` with the **answer only** (no “esperando siguiente mensaje”, no session ids).
- Then silently `wait` again.

## Loop

```text
pair once → wait (silent) → work on text → reply (answer only) → wait → …
```

From **current project cwd**; script path = Sendell install:

```powershell
$sh = "C:\Users\Daniel\Desktop\Daniel\sendell-remote-control\forge-forge-sky-cabin\scripts\sendell-remote.mjs"
node $sh pair --code CODE --hub http://192.168.1.8:8080 --cwd (Get-Location)
node $sh wait --cwd (Get-Location) --timeout 300000
# on prompt JSON → do work
node $sh reply --cwd (Get-Location) --text "answer only"
```

## Rules

- No API keys  
- No `sendell-bridge --demo` for this mode  
- `wait` timeout → silently wait again (exit 0)  
- User says stop → stop loop, one word: `rc off`
