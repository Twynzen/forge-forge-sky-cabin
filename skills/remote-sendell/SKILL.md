# Skill: Sendell Remote — `/remote-sendell` · short `rs`

## CRITICAL — do not confuse with Claude session resume

| Message | Meaning |
|---------|---------|
| **`/remote-sendell 6X38DZ`** | Sendell phone pairing (ALWAYS this) |
| **`rs 6X38DZ`** | Same — short form |
| **`rc 6X38DZ`** | ALSO Sendell **if** `~/.sendell/config.json` exists. **NOT** Claude session load. |
| Claude resume / other `rc` skills | Only if user says **Claude** / session resume, or no Sendell config |

If the user pastes a 6-char code from the Sendell phone app ("Link console"), this is **pairing**, never "Load Claude session as JSON".

---

## When this skill wins

User message is exactly or starts with:

- `/remote-sendell <CODE>`
- `rs <CODE>`
- `rc <CODE>` (6–8 alphanumeric, Sendell pairing)

Then: **pair + silent wait**. Do **not** open Claude resume skills.

---

## Visible chat (strict)

| Moment | Print |
|--------|--------|
| After pair OK | **`rc`** only (one line) |
| While waiting | **nothing** |
| Phone prompt | Real work |
| Local keyboard while linked | Mirror with `reply --user "..."` then answer |
| stop | **`rc off`** |

## Commands

```powershell
$cfg = Get-Content "$env:USERPROFILE\.sendell\config.json" | ConvertFrom-Json
$sh = $cfg.scriptPath
$hub = $cfg.hub
# CODE from phone Link console only
node $sh pair --code CODE --hub $hub --cwd (Get-Location)
# stdout: rc
node $sh wait --cwd (Get-Location)
# forever; phone prompt → work → reply → wait again
# local typing → node $sh reply --user "LOCAL" --text "ANSWER"
```

No API keys. No invented codes. No Claude session JSON for these codes.
