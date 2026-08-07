# /remote-sendell — silent agent loop

---

`/remote-sendell`

code: `PEGAR_CODIGO`  
hub: `http://192.168.1.8:8080`  
script: `C:\Users\Daniel\Desktop\Daniel\sendell-remote-control\forge-forge-sky-cabin\scripts\sendell-remote.mjs`

Rules:
- Quiet tools only. Do **not** narrate waiting/pair/timeouts in chat.
- One optional line after pair: `rc on`
- On each phone `text`: work as a normal user message
- `reply` with the answer only (no “esperando…”, no session ids)
- Then silent wait again until I say stop (`rc off`)

```powershell
$sh = "C:\Users\Daniel\Desktop\Daniel\sendell-remote-control\forge-forge-sky-cabin\scripts\sendell-remote.mjs"
node $sh pair --code PEGAR_CODIGO --hub http://192.168.1.8:8080 --cwd (Get-Location)
node $sh wait --cwd (Get-Location) --timeout 300000
```
