# Skill: Sendell Remote — `/remote-sendell` · `rs` · one answer both sides

## CRITICAL — not Claude session resume

| Message | Meaning |
|---------|---------|
| `/remote-sendell CODE` or `rs CODE` | Sendell phone pairing |
| `rc CODE` (6–8 chars, Sendell app) | Same — **not** Claude “Load session JSON” |

---

## ONE answer rule (phone = terminal)

While `/rc` is linked you produce **exactly one** final answer body for each turn.

| ❌ Wrong | ✅ Right |
|----------|----------|
| Long answer in TUI **and** a different `reply --text` | Compose once → **`say`** |
| Paraphrase for the phone | Phone and TUI get **identical** bytes |
| Two assistant bubbles on the phone | One `say` per user turn |

### How to answer (required)

```powershell
$cfg = Get-Content "$env:USERPROFILE\.sendell\config.json" | ConvertFrom-Json
$sh = $cfg.scriptPath

# Write the full final markdown ONCE into the command (or a file):
node $sh say --cwd (Get-Location) --text @"
## Your full answer here
same tables, same lists, same questions
"@

# Local keyboard turn (user typed in Grok, not from phone):
node $sh say --cwd (Get-Location) --user "exact local user text" --text @"
full answer
"@
```

- **`say` prints that exact text to stdout** (that is the TUI answer — do not invent a second version after).
- **`say` pushes the same text to the phone.**
- Do **not** call `reply` after `say` with a rewrite.
- Prefer `say --file path` if you wrote `.sendell/outbox.md` first.

### Phone → you

1. `wait` exits with **plain stdout** = user message (treat as normal human turn).
2. Do the work.
3. **One** `say --text "..."` with the complete final answer.
4. Start `wait` again silently.

### Pair

```powershell
node $sh pair --code CODE --hub $hub --cwd (Get-Location)
# print only: rc
node $sh wait --cwd (Get-Location)
```

### Visible chat

| Moment | Print |
|--------|--------|
| After pair | `rc` only |
| Waiting | nothing |
| After `say` | only the `say` stdout body (already printed) |
| stop | `rc off` |

No API keys. No double answers.
