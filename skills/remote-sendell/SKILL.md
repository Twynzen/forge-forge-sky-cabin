# Skill: `rc` / `/remote-sendell` — low token

## Visible chat (strict)

| Moment | Print |
|--------|--------|
| After pair OK | **`rc`** only |
| While waiting | **nothing** |
| On phone prompt | Real work only |
| stop | **`rc off`** |

## Token rules

- Idle wait is **Node forever long-poll** (no LLM tokens).
- Start **one** `wait` in background (default timeout=0 forever).
- **Do not** use `--timeout 300000` restarts — that re-wakes the model and burns tokens.
- Do not narrate pair/wait/timeouts.

## Commands

```powershell
$cfg = Get-Content "$env:USERPROFILE\.sendell\config.json" | ConvertFrom-Json
$sh = $cfg.scriptPath
$hub = $cfg.hub
node $sh pair --code CODE --hub $hub --cwd (Get-Location)
# stdout: rc  → show only that
node $sh wait --cwd (Get-Location)
# forever; when JSON type=prompt → work → reply → wait again once
node $sh reply --cwd (Get-Location) --text "ANSWER_ONLY"
```

No API keys. Phone text = normal user message.
