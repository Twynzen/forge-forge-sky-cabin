# Skill: `/remote-sendell` · short form `rc`

## One-line activation (after one-time install)

User types **only**:

```text
rc ABC123
```

or:

```text
/remote-sendell ABC123
```

Read hub + script from `%USERPROFILE%\.sendell\config.json` (or `~/.sendell/config.json`).  
If missing, use script path from this repo: `scripts/sendell-remote.mjs`.

---

## UX: normal session + quiet remote (Cloudy-style)

| Do | Don't |
|----|--------|
| After pair, **one line**: `rc on` | Narrate waiting / timeouts / "loop started" |
| Treat phone `text` as if typed **in this terminal** | Dump pair tables or tool prose in chat |
| Reply in TUI with real work; `reply` answer-only to phone | "Esperando siguiente mensaje", session ids |
| Keep working on local keystrokes too | Use `sendell-bridge --demo` |

Phone and keyboard are both normal user input. Remote is a second door into the **same** session.

You cannot paint a green badge inside Grok’s chrome (product limit). Closest signal: short `rc on` and quiet tools.

---

## Loop (silent)

```powershell
$cfg = Get-Content "$env:USERPROFILE\.sendell\config.json" | ConvertFrom-Json
$sh = $cfg.scriptPath
$hub = $cfg.hub
node $sh pair --code CODE --hub $hub --cwd (Get-Location)
node $sh wait --cwd (Get-Location) --timeout 300000
# type=prompt → do work as normal user message
node $sh reply --cwd (Get-Location) --text "ANSWER_ONLY"
# wait again — do not narrate
```

---

## One-time install (user or you run once)

```powershell
node path\to\sendell\scripts\install-remote-sendell.mjs --hub http://192.168.1.8:8080 --project (Get-Location)
```

Then every session is just: `rc CODIGO` from the phone’s pairing code.
