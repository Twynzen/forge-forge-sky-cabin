#!/usr/bin/env node
/**
 * Sendell Remote — agent-native CLI (Grok / Claude / Gemini / Codex)
 *
 * Phone prompts become normal work for the agent in THIS terminal session.
 * The agent pulls a remote message, answers it like any user message, posts the reply.
 *
 * Commands:
 *   pair   --code XXX --hub URL [--cwd DIR]
 *   wait   [--timeout MS]          long-poll one phone prompt (JSON on stdout)
 *   reply  --text "..." | --file f  send assistant reply to phone
 *   status
 *   auto   --code XXX --hub URL    legacy auto-responder (no agent brain)
 *
 * Session file (per project):  .sendell/session.json
 *
 * /remote-sendell skill loop:
 *   1) pair once
 *   2) wait → treat text as user message (optional flag [sendell-remote])
 *   3) do real work
 *   4) reply with the answer
 *   5) goto 2 until user says stop
 */

import { hostname as osHostname } from "node:os";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

function arg(name, fallback = undefined) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? true;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

const cmd = process.argv[2] || "help";

function sessionDir(cwd) {
  return join(cwd, ".sendell");
}

function sessionPath(cwd) {
  return join(sessionDir(cwd), "session.json");
}

function loadSession(cwd) {
  const p = sessionPath(cwd);
  if (!existsSync(p)) {
    throw new Error(
      `No session at ${p}. Run: node scripts/sendell-remote.mjs pair --code … --hub …`,
    );
  }
  return JSON.parse(readFileSync(p, "utf8"));
}

function saveSession(cwd, data) {
  const dir = sessionDir(cwd);
  mkdirSync(dir, { recursive: true });
  writeFileSync(sessionPath(cwd), JSON.stringify(data, null, 2), "utf8");
  // ignore from git if possible
  const ignore = join(dir, ".gitignore");
  if (!existsSync(ignore)) writeFileSync(ignore, "*\n", "utf8");
}

async function api(hubBase, path, opts = {}) {
  const res = await fetch(`${hubBase}${path}`, {
    ...opts,
    headers: {
      "content-type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${res.status} ${path}`);
  return data;
}

function log(...args) {
  console.error("[sendell-remote]", ...args);
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── pair ────────────────────────────────────────────────────────────
async function cmdPair() {
  const code = String(arg("code", "") || "").trim();
  const hubBase = String(
    arg("hub", process.env.SENDELL_HUB || "http://127.0.0.1:8080"),
  ).replace(/\/$/, "");
  const cwd = resolve(String(arg("cwd", process.cwd())));
  const provider = String(arg("provider", "grok-build"));
  const agentName = String(arg("agent", "Grok Build"));

  if (!code) {
    console.error("Usage: pair --code XXXXXX --hub URL [--cwd DIR]");
    process.exit(1);
  }

  log("pairing", { hubBase, code, cwd });
  const pair = await api(hubBase, "/api/bridge/pair", {
    method: "POST",
    body: JSON.stringify({
      code,
      providerId: provider,
      hostname: osHostname(),
      cwd,
      agentName,
      demo: false,
    }),
  });

  const session = {
    hub: hubBase,
    code,
    sessionId: pair.sessionId,
    sessionToken: pair.sessionToken,
    providerId: pair.providerId || provider,
    cwd,
    hostname: osHostname(),
    agentName,
    pairedAt: Date.now(),
  };
  saveSession(cwd, session);

  await api(hubBase, "/api/bridge/events", {
    method: "POST",
    body: JSON.stringify({
      token: session.sessionToken,
      events: [
        {
          type: "hello",
          remoteSessionId: `agent_${Date.now().toString(36)}`,
          model: agentName,
        },
        {
          type: "message",
          message: {
            id: uid("msg"),
            role: "system",
            content: [
              {
                type: "text",
                text:
                  `**Agent session linked** on **${osHostname()}**\n` +
                  `cwd: \`${cwd}\`\n` +
                  `Phone prompts will be handled **inside this agent** (same terminal session). ` +
                  `Flag: messages may be tagged [sendell-remote] — content is a normal user prompt.`,
              },
            ],
            createdAt: Date.now(),
          },
        },
        { type: "status", status: "ready" },
      ],
    }),
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        sessionId: session.sessionId,
        cwd,
        hub: hubBase,
        sessionFile: sessionPath(cwd),
        next: "Run: node scripts/sendell-remote.mjs wait   then answer, then reply",
      },
      null,
      2,
    ),
  );
}

// ── wait — one phone prompt ─────────────────────────────────────────
async function cmdWait() {
  const cwd = resolve(String(arg("cwd", process.cwd())));
  const timeout = Number(arg("timeout", "120000")) || 120000;
  const session = loadSession(cwd);
  const token = session.sessionToken;
  const hub = session.hub;

  log("waiting for phone prompt…", { timeout, sessionId: session.sessionId });

  // heartbeat + long-poll (hub max ~25s; loop until timeout)
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      await api(hub, "/api/bridge/heartbeat", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      const remain = Math.max(1000, Math.min(20000, deadline - Date.now()));
      const { commands } = await api(
        hub,
        `/api/bridge/commands?token=${encodeURIComponent(token)}&timeout=${remain}`,
      );
      for (const c of commands || []) {
        if (c.type === "prompt" && c.text) {
          // mark thinking on phone
          await api(hub, "/api/bridge/events", {
            method: "POST",
            body: JSON.stringify({
              token,
              events: [{ type: "status", status: "thinking" }],
            }),
          });
          const payload = {
            type: "prompt",
            id: c.id,
            text: c.text,
            /** Present this to the agent as a normal user message */
            agentMessage: c.text,
            flag: "sendell-remote",
            display: `[sendell-remote] ${c.text}`,
            sessionId: session.sessionId,
            hint: "Answer this as a normal user prompt. Then: node scripts/sendell-remote.mjs reply --text \"…your answer…\"",
          };
          // stdout = machine-readable for the agent
          console.log(JSON.stringify(payload, null, 2));
          return;
        }
        if (c.type === "cancel") {
          console.log(JSON.stringify({ type: "cancel" }));
          return;
        }
      }
    } catch (err) {
      log("wait error", err.message || err);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  console.log(JSON.stringify({ type: "timeout", message: "No phone prompt yet" }));
  process.exit(2);
}

// ── reply ───────────────────────────────────────────────────────────
async function cmdReply() {
  const cwd = resolve(String(arg("cwd", process.cwd())));
  const session = loadSession(cwd);
  let text = arg("text", "");
  const file = arg("file", "");
  if (file && file !== true) {
    text = readFileSync(String(file), "utf8");
  }
  text = String(text || "").trim();
  if (!text) {
    console.error("Usage: reply --text \"answer\"  OR  reply --file path.md");
    process.exit(1);
  }

  const msgId = uid("msg");
  const token = session.sessionToken;
  const hub = session.hub;

  await api(hub, "/api/bridge/events", {
    method: "POST",
    body: JSON.stringify({
      token,
      events: [
        { type: "status", status: "streaming" },
        {
          type: "message",
          message: {
            id: msgId,
            role: "assistant",
            content: [{ type: "text", text: "" }],
            createdAt: Date.now(),
            streaming: true,
          },
        },
      ],
    }),
  });

  // chunk for nicer phone UX
  const parts = text.match(/[\s\S]{1,40}/g) || [text];
  for (const part of parts) {
    await api(hub, "/api/bridge/events", {
      method: "POST",
      body: JSON.stringify({
        token,
        events: [
          { type: "chunk", messageId: msgId, chunk: part, role: "assistant" },
        ],
      }),
    });
  }

  await api(hub, "/api/bridge/events", {
    method: "POST",
    body: JSON.stringify({
      token,
      events: [
        {
          type: "message_update",
          message: {
            id: msgId,
            role: "assistant",
            content: [{ type: "text", text }],
            createdAt: Date.now(),
            streaming: false,
          },
        },
        { type: "status", status: "ready" },
      ],
    }),
  });

  console.log(JSON.stringify({ ok: true, messageId: msgId, chars: text.length }));
}

// ── status ──────────────────────────────────────────────────────────
function cmdStatus() {
  const cwd = resolve(String(arg("cwd", process.cwd())));
  try {
    const s = loadSession(cwd);
    console.log(
      JSON.stringify(
        {
          ok: true,
          sessionId: s.sessionId,
          hub: s.hub,
          cwd: s.cwd,
          pairedAt: s.pairedAt,
          sessionFile: sessionPath(cwd),
        },
        null,
        2,
      ),
    );
  } catch (e) {
    console.log(JSON.stringify({ ok: false, error: e.message }));
    process.exit(1);
  }
}

// ── auto (legacy bridge demo brain) ─────────────────────────────────
async function cmdAuto() {
  // Re-use old behavior: pair + auto reply without agent
  process.argv.push("--demo");
  log("auto mode = bridge auto-responder (no Grok brain). Prefer: pair → wait → reply");
  const { spawn } = await import("node:child_process");
  const script = new URL("./sendell-bridge.mjs", import.meta.url);
  const child = spawn(process.execPath, [script.pathname, ...process.argv.slice(3), "--demo"], {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  child.on("exit", (c) => process.exit(c ?? 0));
}

function help() {
  console.log(`
Sendell Remote — phone prompts as normal agent turns

  pair   --code XXX --hub URL [--cwd DIR]
  wait   [--timeout 120000] [--cwd DIR]
  reply  --text "..." | --file answer.md [--cwd DIR]
  status [--cwd DIR]
  auto   --code XXX --hub URL     # old auto-responder (not Grok)

Agent loop (/remote-sendell):
  1. pair once (from the project folder where the agent is working)
  2. wait          → JSON with .text  (treat as user message)
  3. do real work in this agent session
  4. reply --text  → phone sees the answer
  5. repeat wait until stop

Env: SENDELL_HUB=http://192.168.1.8:8080
`);
}

const commands = {
  pair: cmdPair,
  wait: cmdWait,
  reply: cmdReply,
  status: cmdStatus,
  auto: cmdAuto,
  help,
};

const fn = commands[cmd] || help;
await fn();
