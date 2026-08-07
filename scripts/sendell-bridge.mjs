#!/usr/bin/env node
/**
 * Sendell Bridge — run NEXT TO your already-authenticated agent console.
 *
 * This process never asks for an xAI / Anthropic API key. It attaches to a
 * live session that is already open via your CLI subscription (e.g. `grok`),
 * and relays prompts / tool permissions from Sendell Remote Control (phone).
 *
 * Usage:
 *   node scripts/sendell-bridge.mjs --code ABC123 --hub https://your-sendell.app
 *   node scripts/sendell-bridge.mjs --code ABC123 --demo
 *
 * Real ACP attach (when grok supports it):
 *   SENDELL_GROK_ACP_CMD=grok SENDELL_GROK_ACP_ARGS=acp \
 *     node scripts/sendell-bridge.mjs --code ABC123 --hub https://…
 *
 * Vision: eventually `grok` itself gains `/remote` which prints a code and
 * runs this bridge internally. Until then, this CLI is the adapter.
 */

import { hostname as osHostname } from "node:os";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { stdin as input, stdout as output } from "node:process";

function arg(name, fallback = undefined) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? true;
}

const code = String(arg("code", "") || "").trim();
const hubBase = String(arg("hub", "http://127.0.0.1:8080")).replace(/\/$/, "");
const demo = process.argv.includes("--demo");
const provider = String(arg("provider", "grok-build"));
const cwd = String(arg("cwd", process.cwd()));
const agentName = String(arg("agent", "Grok Build"));

if (!code) {
  console.error(`
Sendell Bridge — link an open agent console to Sendell Remote Control

  node scripts/sendell-bridge.mjs --code XXXXXX [--hub URL] [--demo]

1. Open Sendell on your phone → Link console → note the pairing code
2. On the machine where your agent is already logged in (subscription):
     node scripts/sendell-bridge.mjs --code XXXXXX --hub <sendell-url>
3. Chat from the phone; tool approvals appear there.

No API keys. Auth stays in your terminal session.
`);
  process.exit(1);
}

async function api(path, opts = {}) {
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
  console.log("[sendell-bridge]", ...args);
}

// ── Pair ────────────────────────────────────────────────────────────
log("pairing with hub", hubBase, "code", code);
const pair = await api("/api/bridge/pair", {
  method: "POST",
  body: JSON.stringify({
    code,
    providerId: provider,
    hostname: osHostname(),
    cwd,
    agentName,
    model: demo ? "demo-console" : undefined,
    demo,
  }),
});
log("linked session", pair.sessionId);
const token = pair.sessionToken;

await api("/api/bridge/events", {
  method: "POST",
  body: JSON.stringify({
    token,
    events: [
      {
        type: "hello",
        remoteSessionId: `local_${Date.now().toString(36)}`,
        model: demo ? "grok-build (demo bridge)" : agentName,
      },
      {
        type: "message",
        message: {
          id: `msg_bridge_${Date.now().toString(36)}`,
          role: "system",
          content: [
            {
              type: "text",
              text: demo
                ? `Bridge online on **${osHostname()}** (demo mode — simulates console tools).`
                : `Bridge online on **${osHostname()}** · cwd \`${cwd}\` · provider **${provider}**. Waiting for phone prompts…`,
            },
          ],
          createdAt: Date.now(),
        },
      },
    ],
  }),
});

// ── Optional real ACP child (stdio) ─────────────────────────────────
let acp = null;
if (!demo && process.env.SENDELL_GROK_ACP_CMD) {
  const cmd = process.env.SENDELL_GROK_ACP_CMD;
  const args = (process.env.SENDELL_GROK_ACP_ARGS || "acp").split(/\s+/).filter(Boolean);
  log("spawning ACP agent", cmd, args.join(" "));
  acp = spawn(cmd, args, { cwd, stdio: ["pipe", "pipe", "inherit"] });
  // Minimal note: full ACP client can be wired here; for now we keep demo path
  // and document real attach. Users with /remote in grok will not need spawn.
}

// ── Demo responder (when --demo or no ACP) ──────────────────────────
async function handlePromptDemo(text) {
  const msgId = `msg_${Date.now().toString(36)}`;
  await api("/api/bridge/events", {
    method: "POST",
    body: JSON.stringify({
      token,
      events: [
        { type: "status", status: "thinking" },
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

  const reply =
    `Console bridge on ${osHostname()} received: “${text}”.\n\n` +
    `This process is attached to your **already authenticated** agent environment. ` +
    `Sendell Remote Control on your phone only relays — it does not hold API keys.\n\n` +
    `Next: wire this bridge to the live ACP stdio of \`grok\` (or use \`/remote\` inside the TUI).`;

  // stream in chunks
  for (const part of reply.match(/.{1,24}/g) || [reply]) {
    await api("/api/bridge/events", {
      method: "POST",
      body: JSON.stringify({
        token,
        events: [
          { type: "status", status: "streaming" },
          { type: "chunk", messageId: msgId, chunk: part, role: "assistant" },
        ],
      }),
    });
    await new Promise((r) => setTimeout(r, 40));
  }

  await api("/api/bridge/events", {
    method: "POST",
    body: JSON.stringify({
      token,
      events: [
        {
          type: "message_update",
          message: {
            id: msgId,
            role: "assistant",
            content: [{ type: "text", text: reply }],
            createdAt: Date.now(),
            streaming: false,
          },
        },
        { type: "status", status: "ready" },
      ],
    }),
  });
}

// ── Command loop ────────────────────────────────────────────────────
log("listening for phone commands… (Ctrl+C to detach)");
let running = true;
process.on("SIGINT", () => {
  running = false;
  log("detaching");
  process.exit(0);
});

while (running) {
  try {
    await api("/api/bridge/heartbeat", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
    const { commands } = await api(
      `/api/bridge/commands?token=${encodeURIComponent(token)}&timeout=20000`,
    );
    for (const cmd of commands || []) {
      if (cmd.type === "prompt") {
        log("prompt from phone:", String(cmd.text).slice(0, 80));
        if (demo || !acp) await handlePromptDemo(cmd.text);
        else log("ACP spawn present — extend bridge to forward session/prompt");
      } else if (cmd.type === "permission") {
        log("permission decision", cmd.toolCallId, cmd.decision);
      } else if (cmd.type === "cancel") {
        log("cancel from phone");
      }
    }
  } catch (err) {
    log("loop error", err.message || err);
    await new Promise((r) => setTimeout(r, 2000));
  }
}
