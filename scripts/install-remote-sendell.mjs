#!/usr/bin/env node
/**
 * One-time setup: Sendell /remote-sendell for Grok (and similar agents).
 *
 * What it does:
 *  1) Saves config:  %USERPROFILE%\.sendell\config.json  (or ~/.sendell)
 *  2) Writes a global skill:  ~/.sendell/skills/remote-sendell.md
 *  3) Writes a tiny activator line for projects: AGENTS.snippet.md
 *  4) Optional: appends short instructions to a project AGENTS.md
 *
 * After install, in Grok you only type:
 *    rc ABC123
 * or:
 *    /remote-sendell ABC123
 *
 * No long WhatsApp paste. Hub defaults to env or the URL you pass once.
 *
 * Usage:
 *   node scripts/install-remote-sendell.mjs --hub http://192.168.1.8:8080
 *   node scripts/install-remote-sendell.mjs --hub http://192.168.1.8:8080 --project "C:\Users\...\dystopia-rp"
 */

import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  appendFileSync,
  copyFileSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? true;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const sendellRoot = resolve(__dirname, "..");
const scriptPath = join(sendellRoot, "scripts", "sendell-remote.mjs");
const hub = String(
  arg("hub", process.env.SENDELL_HUB || "http://127.0.0.1:8080"),
).replace(/\/$/, "");
const project = arg("project", "") ? resolve(String(arg("project"))) : null;

const homeSendell = join(homedir(), ".sendell");
const skillDir = join(homeSendell, "skills");
mkdirSync(skillDir, { recursive: true });

const config = {
  hub,
  sendellRoot,
  scriptPath,
  installedAt: new Date().toISOString(),
};
writeFileSync(join(homeSendell, "config.json"), JSON.stringify(config, null, 2));

const scriptEsc = scriptPath.replace(/\\/g, "\\\\");

const skillBody = `# remote-sendell — one answer both sides

CRITICAL: \`/remote-sendell CODE\` / \`rs CODE\` / \`rc CODE\` (Sendell phone) = pair. NOT Claude session JSON.

## ONE answer
Use **say** so phone and TUI get the same text:
\`\`\`powershell
$cfg = Get-Content "$env:USERPROFILE\\.sendell\\config.json" | ConvertFrom-Json
$sh = $cfg.scriptPath
$hub = $cfg.hub
node $sh pair --code CODE --hub $hub --cwd (Get-Location)
node $sh wait --cwd (Get-Location)
# after work:
node $sh say --cwd (Get-Location) --text "FULL FINAL MARKDOWN ANSWER"
# local typing:
node $sh say --cwd (Get-Location) --user "LOCAL USER TEXT" --text "FULL ANSWER"
\`\`\`
Never paraphrase a second version with reply. say = stdout + phone identical.
Hub: ${hub}
Script: ${scriptEsc}
`;`;

writeFileSync(join(skillDir, "remote-sendell.md"), skillBody);

// Project snippet
const snippet = `
## Sendell remote — one answer
\`/remote-sendell CODE\` or \`rs CODE\` to pair. While linked: answer with **say** only (phone = TUI identical). Not Claude resume.
`.trim();

writeFileSync(join(homeSendell, "AGENTS.snippet.md"), snippet + "\n");

if (project) {
  const agents = join(project, "AGENTS.md");
  const block = `\n\n<!-- sendell-remote -->\n${snippet}\n<!-- /sendell-remote -->\n`;
  if (existsSync(agents)) {
    const cur = readFileSync(agents, "utf8");
    if (!cur.includes("sendell-remote")) appendFileSync(agents, block);
  } else {
    writeFileSync(agents, `# Agent notes\n${block}`);
  }
  // also copy skill into project if .grok/skills exists or create skills/
  const projSkill = join(project, "skills", "remote-sendell");
  mkdirSync(projSkill, { recursive: true });
  copyFileSync(
    join(sendellRoot, "skills", "remote-sendell", "SKILL.md"),
    join(projSkill, "SKILL.md"),
  );
}

// Windows helper: rc.cmd in ~/.sendell
const rcCmd = `@echo off
REM Usage from any shell:  rc  (prints how to activate in Grok)
echo.
echo  Sendell remote — no long paste needed
echo  --------------------------------------
echo  1. Phone: Link console -^> copy CODE only
echo  2. In Grok (this project), type:
echo.
echo       rc YOURCODE
echo.
echo  Hub: ${hub}
echo  Script: ${scriptPath}
echo  Config: %USERPROFILE%\\.sendell\\config.json
echo.
`;
writeFileSync(join(homeSendell, "rc.cmd"), rcCmd);

console.log(`
Sendell remote installed (one-time)

  Config:  ${join(homeSendell, "config.json")}
  Skill:   ${join(skillDir, "remote-sendell.md")}
  Hub:     ${hub}
  Script:  ${scriptPath}
${project ? `  Project: ${project} (AGENTS.md updated)\n` : ""}
How you activate from now on
  1) Phone: Link console → note the CODE (6 chars)
  2) In Grok prefer (avoids Claude "rc" confusion):

       /remote-sendell CODIGO

  or short:  rs CODIGO
  (rc CODIGO also works if Sendell skill wins)

  Grok should print only: rc
`);
