# Skill: `rc` / `/remote-sendell` — low token + shared transcript

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
- Do not narrate pair/wait/timeouts.

## Commands

```powershell
$cfg = Get-Content "$env:USERPROFILE\.sendell\config.json" | ConvertFrom-Json
$sh = $cfg.scriptPath
$hub = $cfg.hub
node $sh pair --code CODE --hub $hub --cwd (Get-Location)
node $sh wait --cwd (Get-Location)
```

### Phone prompt (`wait` returns JSON type=prompt)
- Treat `text` as normal user message (already on phone).
- Answer, then: `node $sh reply --cwd (Get-Location) --text "ANSWER_ONLY"`
- Start `wait` again silently.

### Local keyboard (you typed in Grok, not from wait)
- Phone must see **both** sides. Mirror human first, then answer:
```powershell
node $sh reply --cwd (Get-Location) --user "EXACT_LOCAL_USER_TEXT" --text "ANSWER_ONLY"
```
- Or: `node $sh note-user --cwd (Get-Location) --text "LOCAL_TEXT"` then `reply --text "..."`
- Do this for **every** local user turn while `/rc` is on.

No API keys. Phone and keyboard share one transcript.
