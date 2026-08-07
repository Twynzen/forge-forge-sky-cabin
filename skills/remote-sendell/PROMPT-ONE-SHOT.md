# /remote-sendell — paste into Grok (agent loop)

---

`/remote-sendell`

Hub: `http://192.168.1.8:8080`  
Code: `PEGAR_CODIGO`  
Sendell install: `C:\Users\Daniel\Desktop\Daniel\sendell-remote-control\forge-forge-sky-cabin`

Do this in a **loop** (do not use the old auto bridge responder):

1. From **this project folder** (where I am now), run pair:

```powershell
node "C:\Users\Daniel\Desktop\Daniel\sendell-remote-control\forge-forge-sky-cabin\scripts\sendell-remote.mjs" pair --code PEGAR_CODIGO --hub http://192.168.1.8:8080 --cwd (Get-Location)
```

2. Run wait (blocks until the phone sends a message):

```powershell
node "C:\Users\Daniel\Desktop\Daniel\sendell-remote-control\forge-forge-sky-cabin\scripts\sendell-remote.mjs" wait --cwd (Get-Location) --timeout 300000
```

3. When JSON has `"type":"prompt"`, treat `"text"` as a **normal user message** from me (tag [sendell-remote] is only a flag — same quality work).

4. After you finish, send the answer to the phone:

```powershell
node "C:\Users\Daniel\Desktop\Daniel\sendell-remote-control\forge-forge-sky-cabin\scripts\sendell-remote.mjs" reply --cwd (Get-Location) --text "YOUR ANSWER"
```

5. Go back to step 2 until I say stop.

No API keys. No sendell-bridge.mjs --demo.
