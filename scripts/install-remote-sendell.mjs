#!/usr/bin/env node
/**
 * One-time setup: Sendell /remote-sendell for Grok (and similar agents).
 *
 * Usage:
 *   node scripts/install-remote-sendell.mjs --hub http://VPS_IP:8080
 *   node scripts/install-remote-sendell.mjs --hub http://VPS_IP:8080 --project "C:\Users\...\dystopia-rp"
 *
 * --hub     = URL of the Sendell hub (VPS or local)
 * --project = folder where Grok works on THIS machine (not the VPS)
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

if (/TU_IP|YOUR_VPS|localhost|127\.0\.0\.1|192\.168\./i.test(hub)) {
  // soft warning only — user may still use LAN IP on purpose
  if (/TU_IP|YOUR_VPS/i.test(hub)) {
    console.error(
      "ERROR: replace TU_IP with your real VPS public IP, e.g. http://207.180.x.x:8080",
    );
    process.exit(1);
  }
}

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

const skillBody = [
  "# remote-sendell — one answer both sides",
  "",
  "CRITICAL: `/remote-sendell CODE` / `rs CODE` / `rc CODE` (Sendell phone) = pair. NOT Claude session JSON.",
  "",
  "## Hub (must match phone URL)",
  "",
  "Config file: `~/.sendell/config.json` field `hub`.",
  `Current hub: ${hub}`,
  `Script: ${scriptPath}`,
  "",
  "## Pair",
  "",
  "```powershell",
  '$cfg = Get-Content "$env:USERPROFILE\\.sendell\\config.json" | ConvertFrom-Json',
  "$sh = $cfg.scriptPath",
  "$hub = $cfg.hub",
  "node $sh pair --code CODE --hub $hub --cwd (Get-Location)",
  "node $sh wait --cwd (Get-Location)",
  "```",
  "",
  "## ONE answer (phone = TUI identical)",
  "",
  "```powershell",
  'node $sh say --cwd (Get-Location) --text "FULL FINAL MARKDOWN ANSWER"',
  'node $sh say --cwd (Get-Location) --user "LOCAL USER TEXT" --text "FULL ANSWER"',
  "```",
  "",
  "Never paraphrase a second version with reply. Use **say** only.",
  "",
].join("\n");

writeFileSync(join(skillDir, "remote-sendell.md"), skillBody);

const snippet = [
  "## Sendell remote — one answer",
  "`/remote-sendell CODE` or `rs CODE` to pair (hub from ~/.sendell/config.json).",
  "While linked: answer with **say** only (phone = TUI identical). Not Claude resume.",
].join("\n");

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
  const skillSrc = join(sendellRoot, "skills", "remote-sendell", "SKILL.md");
  if (existsSync(skillSrc)) {
    const projSkill = join(project, "skills", "remote-sendell");
    mkdirSync(projSkill, { recursive: true });
    copyFileSync(skillSrc, join(projSkill, "SKILL.md"));
  }
}

const rcCmd = [
  "@echo off",
  "echo Sendell remote",
  "echo 1. Phone: Link console - code",
  "echo 2. Grok: /remote-sendell YOURCODE",
  `echo Hub: ${hub}`,
  `echo Script: ${scriptPath}`,
  "echo Config: %USERPROFILE%\\.sendell\\config.json",
  "",
].join("\r\n");
writeFileSync(join(homeSendell, "rc.cmd"), rcCmd);

console.log(`
Sendell remote installed

  Config:  ${join(homeSendell, "config.json")}
  Skill:   ${join(skillDir, "remote-sendell.md")}
  Hub:     ${hub}
  Script:  ${scriptPath}
${project ? `  Project: ${project}\n` : ""}
Activate:
  1) Phone opens the SAME hub URL: ${hub}
  2) Link console → CODE
  3) In Grok:  /remote-sendell CODE
`);
