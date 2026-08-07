#!/usr/bin/env node
/**
 * Sendell Remote — low-token agent CLI
 *
 * Idle cost: pure Node long-poll (no LLM). Grok should start wait ONCE as a
 * background shell and leave it; do not re-invoke on timeouts.
 *
 *   pair   --code XXX --hub URL [--cwd DIR]
 *   wait   [--timeout MS]   default: 0 = forever until prompt/cancel
 *   reply  --text "..." | --file f
 *   status
 */

import { hostname as osHostname } from "node:os";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

function arg(name, fallback = undefined) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? true;
}

const verbose = process.argv.includes("--verbose");
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
    throw new Error(`No session. Run: pair --code … --hub …`);
  }
  return JSON.parse(readFileSync(p, "utf8"));
}

function saveSession(cwd, data) {
  const dir = sessionDir(cwd);
  mkdirSync(dir, { recursive: true });
  writeFileSync(sessionPath(cwd), JSON.stringify(data, null, 2), "utf8");
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
  if (verbose) console.error("[sendell]", ...args);
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

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
        { type: "status", status: "ready" },
      ],
    }),
  });

  console.log("rc");
}

async function cmdWait() {
  const cwd = resolve(String(arg("cwd", process.cwd())));
  const raw = arg("timeout", "0");
  const timeout = Number(raw);
  const forever = !timeout || timeout <= 0;
  const session = loadSession(cwd);
  const token = session.sessionToken;
  const hub = session.hub;

  log("wait forever=", forever, session.sessionId);

  const deadline = forever ? Infinity : Date.now() + timeout;

  while (Date.now() < deadline) {
    try {
      await api(hub, "/api/bridge/heartbeat", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      const remain = forever
        ? 25000
        : Math.max(1000, Math.min(20000, deadline - Date.now()));
      const { commands } = await api(
        hub,
        `/api/bridge/commands?token=${encodeURIComponent(token)}&timeout=${remain}`,
      );
      for (const c of commands || []) {
        if (c.type === "prompt" && c.text) {
          await api(hub, "/api/bridge/events", {
            method: "POST",
            body: JSON.stringify({
              token,
              events: [{ type: "status", status: "thinking" }],
            }),
          });
          // Clean TUI: phone text looks like a normal user turn.
          // JSON stays on stderr for machines; agents should use stdout text.
          console.log(c.text);
          console.error(
            JSON.stringify({
              type: "prompt",
              id: c.id,
              text: c.text,
              flag: "sendell-remote",
            }),
          );
          return;
        }
        if (c.type === "cancel") {
          console.log(JSON.stringify({ type: "cancel" }));
          return;
        }
      }
    } catch (err) {
      log("wait error", err.message || err);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  console.log(JSON.stringify({ type: "timeout" }));
  process.exit(0);
}


async function cmdNoteUser() {
  const cwd = resolve(String(arg("cwd", process.cwd())));
  const session = loadSession(cwd);
  let text = arg("text", "");
  const file = arg("file", "");
  if (file && file !== true) {
    text = readFileSync(String(file), "utf8");
  }
  text = String(text || "").trim();
  if (!text) {
    console.error('Usage: note-user --text "..."');
    process.exit(1);
  }
  const msgId = uid("msg");
  await api(session.hub, "/api/bridge/events", {
    method: "POST",
    body: JSON.stringify({
      token: session.sessionToken,
      events: [
        {
          type: "message",
          message: {
            id: msgId,
            role: "user",
            content: [{ type: "text", text }],
            createdAt: Date.now(),
            meta: { source: "console" },
          },
        },
      ],
    }),
  });
  console.log("ok");
}

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
    console.error('Usage: reply --text "..." [--user "..."] | --file path');
    process.exit(1);
  }

  const msgId = uid("msg");
  const token = session.sessionToken;
  const hub = session.hub;

  // Optional: mirror local keyboard prompt so phone sees human side
  const userText = String(arg("user", "") || "").trim();
  if (userText) {
    await api(hub, "/api/bridge/events", {
      method: "POST",
      body: JSON.stringify({
        token,
        events: [
          {
            type: "message",
            message: {
              id: uid("msg"),
              role: "user",
              content: [{ type: "text", text: userText }],
              createdAt: Date.now(),
              meta: { source: "console" },
            },
          },
        ],
      }),
    });
  }

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

  const parts = text.match(/[\s\S]{1,64}/g) || [text];
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

  console.log("ok");
}

function cmdStatus() {
  const cwd = resolve(String(arg("cwd", process.cwd())));
  try {
    loadSession(cwd);
    console.log("rc");
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

function help() {
  console.log(`sendell-remote: pair | wait | reply | note-user | status
  pair  --code X --hub URL [--cwd DIR]   → prints: rc
  wait  [--timeout 0]                    → 0=forever (default), idle = no LLM
  note-user --text "..."                 → mirror local human msg to phone
  reply --text "..." [--user "..."]      → assistant (+ optional local user)
Env: SENDELL_HUB`);
}

const commands = {
  pair: cmdPair,
  wait: cmdWait,
  reply: cmdReply,
  "note-user": cmdNoteUser,
  status: cmdStatus,
  help,
};

const fn = commands[cmd] || help;
await fn();
