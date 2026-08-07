/**
 * Sendell Hub — links open agent consoles (subscription/OAuth) to phone operators.
 *
 * Primary: pairing codes + bridge/agent loop (no API key in the phone app).
 * Chat stays clean: no verbose system spam — status lives in the header (/rc).
 */

import { EventEmitter } from "node:events";
import {
  enqueueCommand,
  getBridgeBySession,
  getBridgeByToken,
  makeCommandId,
  registerBridge,
  unregisterBridge,
  waitForCommands,
  touchBridge,
} from "./bridge-registry";
import { formatPairingCode, generatePairingCode, normalizePairingCode } from "./pairing";
import type {
  BridgeEvent,
  BridgePairInput,
  BridgePairResult,
  ChatMessage,
  CreateLinkRoomInput,
  HubEvent,
  PermissionDecisionInput,
  ProviderId,
  ProviderInfo,
  SendPromptInput,
  SessionMeta,
  SessionSnapshot,
  ToolCall,
} from "./types";
import { runDemoConsoleAgent } from "./demo-console";

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

interface InternalSession {
  meta: SessionMeta;
  messages: ChatMessage[];
  pendingPermissions: ToolCall[];
  plan?: import("./types").PlanStep[];
  rev: number;
  pairingNormalized: string;
  sessionToken?: string;
  demoAbort?: AbortController;
}

const PROVIDERS: ProviderInfo[] = [
  {
    id: "grok-build",
    name: "Grok Build",
    description:
      "Link a live `grok` console (subscription / OAuth). API-key path kept for later.",
    available: true,
    transport: "console-bridge",
    accent: "accent",
    icon: "sparkles",
  },
  {
    id: "claude-code",
    name: "Claude Code",
    description: "Link a live Claude Code terminal (roadmap)",
    available: false,
    transport: "stub",
    accent: "muted",
    icon: "bot",
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    description: "Link a live Gemini CLI terminal (roadmap)",
    available: false,
    transport: "stub",
    accent: "muted",
    icon: "hexagon",
  },
  {
    id: "gpt",
    name: "GPT / Codex",
    description: "Link a live Codex CLI terminal (roadmap)",
    available: false,
    transport: "stub",
    accent: "muted",
    icon: "cpu",
  },
];

class Hub {
  private sessions = new Map<string, InternalSession>();
  private codeIndex = new Map<string, string>();
  private bus = new EventEmitter();
  private seeded = false;

  constructor() {
    this.bus.setMaxListeners(200);
  }

  subscribe(handler: (event: HubEvent) => void, sessionId?: string): () => void {
    const wrapped = (event: HubEvent) => {
      if (!sessionId) {
        handler(event);
        return;
      }
      if ("sessionId" in event && (event as { sessionId?: string }).sessionId === sessionId) {
        handler(event);
        return;
      }
      if (event.type === "session.created" && event.session.id === sessionId) handler(event);
      if (event.type === "session.updated" && event.session.id === sessionId) handler(event);
      if (event.type === "session.removed" && event.sessionId === sessionId) handler(event);
      if (event.type === "heartbeat") handler(event);
    };
    this.bus.on("event", wrapped);
    return () => this.bus.off("event", wrapped);
  }

  private emit(event: HubEvent) {
    this.bus.emit("event", event);
  }

  private touch(session: InternalSession, patch: Partial<SessionMeta>) {
    session.meta = { ...session.meta, ...patch, updatedAt: Date.now() };
    session.rev += 1;
    this.emit({ type: "session.updated", session: { ...session.meta } });
  }

  listProviders(): ProviderInfo[] {
    return PROVIDERS.map((p) => ({ ...p }));
  }

  listSessions(): SessionMeta[] {
    return Array.from(this.sessions.values())
      .map((s) => ({ ...s.meta }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getSnapshot(sessionId: string): SessionSnapshot | null {
    const s = this.sessions.get(sessionId);
    if (!s) return null;
    return {
      ...s.meta,
      messages: s.messages.map((m) => ({
        ...m,
        content: m.content.map((c) =>
          c.type === "tool_call"
            ? { ...c, toolCall: { ...c.toolCall } }
            : c.type === "plan"
              ? { ...c, steps: c.steps.map((x) => ({ ...x })) }
              : { ...c },
        ),
      })),
      pendingPermissions: s.pendingPermissions.map((t) => ({ ...t })),
      plan: s.plan?.map((p) => ({ ...p })),
    };
  }

  createLinkRoom(input: CreateLinkRoomInput = {}): SessionSnapshot {
    const id = uid("sess");
    const code = generatePairingCode(6);
    const normalized = normalizePairingCode(code);
    const now = Date.now();
    const providerId: ProviderId = input.providerId || "grok-build";
    const demo = input.demo === true;

    const meta: SessionMeta = {
      id,
      title: input.title || (demo ? "Demo" : "New remote"),
      providerId,
      status: demo ? "ready" : "waiting_link",
      createdAt: now,
      updatedAt: now,
      demo,
      pairingCode: formatPairingCode(code),
      linkState: demo ? "linked" : "waiting",
      linkSource: demo ? "demo" : "phone_room",
      hostLabel: demo ? "demo" : undefined,
      cwd: demo ? undefined : undefined,
      model: demo ? "demo" : undefined,
    };

    const internal: InternalSession = {
      meta,
      messages: [],
      pendingPermissions: [],
      rev: 1,
      pairingNormalized: normalized,
    };
    this.sessions.set(id, internal);
    this.codeIndex.set(normalized, id);
    this.emit({ type: "session.created", session: { ...meta } });

    // No chat spam — pairing code is in the waiting banner / dialog only
    if (demo) {
      const token = uid("tok");
      internal.sessionToken = token;
      registerBridge(id, token);
    }

    return this.getSnapshot(id)!;
  }

  joinWithCode(code: string): SessionSnapshot {
    const normalized = normalizePairingCode(code);
    const existingId = this.codeIndex.get(normalized);
    if (existingId) {
      const snap = this.getSnapshot(existingId);
      if (snap) return snap;
    }

    const id = uid("sess");
    const now = Date.now();
    const meta: SessionMeta = {
      id,
      title: "New remote",
      providerId: "grok-build",
      status: "waiting_link",
      createdAt: now,
      updatedAt: now,
      demo: false,
      pairingCode: formatPairingCode(normalized),
      linkState: "waiting",
      linkSource: "terminal_code",
    };
    const internal: InternalSession = {
      meta,
      messages: [],
      pendingPermissions: [],
      rev: 1,
      pairingNormalized: normalized,
    };
    this.sessions.set(id, internal);
    this.codeIndex.set(normalized, id);
    this.emit({ type: "session.created", session: { ...meta } });
    return this.getSnapshot(id)!;
  }

  pairBridge(input: BridgePairInput): BridgePairResult {
    const normalized = normalizePairingCode(input.code);
    let sessionId = this.codeIndex.get(normalized);

    if (!sessionId) {
      const created = this.joinWithCode(normalized);
      sessionId = created.id;
    }

    const internal = this.sessions.get(sessionId);
    if (!internal) throw new Error("Session not found for code");

    const token = uid("tok");
    internal.sessionToken = token;
    registerBridge(sessionId, token);

    const hostLabel = `${input.hostname} · ${input.cwd}`;
    const bridgeDemo = input.demo === true;
    const shortTitle =
      input.cwd?.split(/[/\\]/).filter(Boolean).pop() ||
      input.hostname ||
      "Remote";

    this.touch(internal, {
      status: "ready",
      linkState: "linked",
      demo: false,
      providerId: input.providerId,
      hostLabel,
      cwd: input.cwd,
      model: input.model || input.agentName || input.providerId,
      title:
        internal.meta.title === "New remote" ||
        internal.meta.title === "Waiting for console…" ||
        internal.meta.title === "Joining console…"
          ? shortTitle
          : internal.meta.title,
    });
    if (bridgeDemo) {
      this.touch(internal, {
        model: `${input.model || "bridge-demo"} · ${input.hostname}`,
      });
    }

    // No system message in chat — /rc badge + header show link state
    return {
      sessionId,
      sessionToken: token,
      providerId: input.providerId,
    };
  }

  async sendPrompt(input: SendPromptInput): Promise<void> {
    const s = this.sessions.get(input.sessionId);
    if (!s) throw new Error("Session not found");
    if (!input.text.trim()) throw new Error("Empty prompt");
    if (s.meta.linkState !== "linked") {
      throw new Error("Console not linked yet — share the pairing code with your terminal");
    }

    if (s.messages.filter((m) => m.role === "user").length === 0) {
      const title =
        input.text.trim().slice(0, 48) + (input.text.trim().length > 48 ? "…" : "");
      this.touch(s, { title });
    }

    const userMsg: ChatMessage = {
      id: uid("msg"),
      role: "user",
      content: [{ type: "text", text: input.text.trim() }],
      createdAt: Date.now(),
    };
    s.messages.push(userMsg);
    this.emit({ type: "message.appended", sessionId: s.meta.id, message: userMsg });
    this.touch(s, { status: "thinking" });

    const bridgeLive = !!s.sessionToken && !!getBridgeBySession(s.meta.id);
    if (bridgeLive) {
      enqueueCommand(s.meta.id, {
        id: makeCommandId(),
        type: "prompt",
        text: input.text.trim(),
        createdAt: Date.now(),
      });
      return;
    }

    if (s.meta.demo) {
      s.demoAbort?.abort();
      s.demoAbort = new AbortController();
      await runDemoConsoleAgent({
        text: input.text.trim(),
        signal: s.demoAbort.signal,
        emit: (ev) => this.applyBridgeEvent(s.meta.id, ev),
        waitPermission: (toolCallId) => this.waitDemoPermission(s.meta.id, toolCallId),
      });
      return;
    }

    throw new Error("No bridge connected — re-run sendell-remote on the agent machine");
  }

  async resolvePermission(input: PermissionDecisionInput): Promise<void> {
    const s = this.sessions.get(input.sessionId);
    if (!s) throw new Error("Session not found");

    this.applyPermissionLocal(s, input.toolCallId, input.decision);

    const bridgeLive = !!s.sessionToken && !!getBridgeBySession(s.meta.id);
    if (bridgeLive) {
      enqueueCommand(s.meta.id, {
        id: makeCommandId(),
        type: "permission",
        toolCallId: input.toolCallId,
        decision: input.decision,
        createdAt: Date.now(),
      });
      return;
    }

    if (s.meta.demo) {
      const waiter = demoPermissionWaiters.get(`${s.meta.id}:${input.toolCallId}`);
      if (waiter) {
        demoPermissionWaiters.delete(`${s.meta.id}:${input.toolCallId}`);
        waiter(input.decision);
      }
    }
  }

  async cancelSession(sessionId: string): Promise<void> {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    s.demoAbort?.abort();
    if (getBridgeBySession(sessionId)) {
      enqueueCommand(sessionId, {
        id: makeCommandId(),
        type: "cancel",
        createdAt: Date.now(),
      });
    }
    this.touch(s, { status: s.meta.linkState === "linked" ? "ready" : s.meta.status });
  }

  async closeSession(sessionId: string): Promise<void> {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    s.demoAbort?.abort();
    unregisterBridge(sessionId);
    this.codeIndex.delete(s.pairingNormalized);
    this.touch(s, { status: "closed", linkState: "disconnected" });
    this.sessions.delete(sessionId);
    this.emit({ type: "session.removed", sessionId });
  }

  async bridgePollCommands(sessionToken: string, timeoutMs = 25000) {
    const conn = getBridgeByToken(sessionToken);
    if (!conn) throw new Error("Invalid session token");
    touchBridge(conn.sessionId);
    return waitForCommands(conn.sessionId, timeoutMs);
  }

  applyBridgeEvents(sessionToken: string, events: BridgeEvent[]): void {
    const conn = getBridgeByToken(sessionToken);
    if (!conn) throw new Error("Invalid session token");
    touchBridge(conn.sessionId);
    for (const ev of events) {
      this.applyBridgeEvent(conn.sessionId, ev);
    }
  }

  bridgeHeartbeat(sessionToken: string): { ok: true; sessionId: string } {
    const conn = getBridgeByToken(sessionToken);
    if (!conn) throw new Error("Invalid session token");
    touchBridge(conn.sessionId);
    const s = this.sessions.get(conn.sessionId);
    if (s && s.meta.linkState === "disconnected") {
      this.touch(s, { linkState: "linked", status: "ready" });
    }
    return { ok: true, sessionId: conn.sessionId };
  }

  private applyBridgeEvent(sessionId: string, ev: BridgeEvent): void {
    const s = this.sessions.get(sessionId);
    if (!s) return;

    switch (ev.type) {
      case "hello":
        this.touch(s, {
          remoteSessionId: ev.remoteSessionId,
          model: ev.model || s.meta.model,
          status: "ready",
          linkState: "linked",
        });
        // Do not inject hello text into chat
        break;
      case "status":
        this.touch(s, { status: ev.status, lastError: ev.error });
        break;
      case "message":
        // Drop system noise from bridge/agent CLI
        if (ev.message.role === "system") {
          this.touch(s, {});
          break;
        }
        s.messages.push(ev.message);
        this.emit({ type: "message.appended", sessionId, message: ev.message });
        this.touch(s, {});
        break;
      case "message_update": {
        const idx = s.messages.findIndex((m) => m.id === ev.message.id);
        if (idx >= 0) s.messages[idx] = ev.message;
        this.emit({ type: "message.updated", sessionId, message: ev.message });
        break;
      }
      case "chunk": {
        const msg = s.messages.find((m) => m.id === ev.messageId);
        if (msg) {
          const textBlock = msg.content.find((c) => c.type === "text");
          if (textBlock && textBlock.type === "text") textBlock.text += ev.chunk;
          else msg.content.push({ type: "text", text: ev.chunk });
          msg.streaming = true;
        }
        this.emit({
          type: "message.chunk",
          sessionId,
          messageId: ev.messageId,
          chunk: ev.chunk,
          role: ev.role,
        });
        break;
      }
      case "tool": {
        let found = false;
        for (const m of s.messages) {
          for (let i = 0; i < m.content.length; i++) {
            const b = m.content[i];
            if (b.type === "tool_call" && b.toolCall.id === ev.toolCall.id) {
              m.content[i] = { type: "tool_call", toolCall: ev.toolCall };
              this.emit({ type: "message.updated", sessionId, message: m });
              found = true;
            }
          }
        }
        if (!found) {
          const msg: ChatMessage = {
            id: uid("msg"),
            role: "assistant",
            content: [{ type: "tool_call", toolCall: ev.toolCall }],
            createdAt: Date.now(),
          };
          s.messages.push(msg);
          this.emit({ type: "message.appended", sessionId, message: msg });
        }
        this.emit({ type: "tool.updated", sessionId, toolCall: ev.toolCall });
        break;
      }
      case "permission":
        s.pendingPermissions = [
          ...s.pendingPermissions.filter((t) => t.id !== ev.toolCall.id),
          ev.toolCall,
        ];
        this.touch(s, { status: "awaiting_permission" });
        this.emit({ type: "permission.requested", sessionId, toolCall: ev.toolCall });
        this.applyBridgeEvent(sessionId, { type: "tool", toolCall: ev.toolCall });
        break;
      case "plan":
        s.plan = ev.steps;
        this.emit({ type: "plan.updated", sessionId, steps: ev.steps });
        {
          const existing = s.messages.find((m) => m.content.some((c) => c.type === "plan"));
          if (existing) {
            existing.content = [{ type: "plan", steps: ev.steps }];
            this.emit({ type: "message.updated", sessionId, message: existing });
          } else {
            const msg: ChatMessage = {
              id: uid("msg"),
              role: "assistant",
              content: [{ type: "plan", steps: ev.steps }],
              createdAt: Date.now(),
            };
            s.messages.push(msg);
            this.emit({ type: "message.appended", sessionId, message: msg });
          }
        }
        break;
      default:
        break;
    }
  }

  private applyPermissionLocal(
    s: InternalSession,
    toolCallId: string,
    decision: PermissionDecisionInput["decision"],
  ) {
    s.pendingPermissions = s.pendingPermissions.filter((t) => t.id !== toolCallId);
    for (const m of s.messages) {
      for (let i = 0; i < m.content.length; i++) {
        const b = m.content[i];
        if (b.type === "tool_call" && b.toolCall.id === toolCallId) {
          const updated: ToolCall = {
            ...b.toolCall,
            status: decision === "reject" ? "rejected" : "running",
            updatedAt: Date.now(),
          };
          m.content[i] = { type: "tool_call", toolCall: updated };
          this.emit({ type: "message.updated", sessionId: s.meta.id, message: m });
          this.emit({ type: "tool.updated", sessionId: s.meta.id, toolCall: updated });
        }
      }
    }
    this.touch(s, { status: "streaming" });
  }

  private waitDemoPermission(
    sessionId: string,
    toolCallId: string,
  ): Promise<"allow" | "allow_always" | "reject"> {
    return new Promise((resolve) => {
      demoPermissionWaiters.set(`${sessionId}:${toolCallId}`, resolve);
    });
  }

  ensureDemoSession(): void {
    if (this.seeded) return;
    this.seeded = true;
    // Do not auto-seed noisy demo on boot — empty start is cleaner
  }
}

function providerLabel(id: ProviderId): string {
  return PROVIDERS.find((p) => p.id === id)?.name ?? id;
}

const demoPermissionWaiters = new Map<
  string,
  (d: "allow" | "allow_always" | "reject") => void
>();

const globalForHub = globalThis as unknown as { __sendellHub?: Hub };

export function getHub(): Hub {
  if (!globalForHub.__sendellHub) {
    globalForHub.__sendellHub = new Hub();
  }
  return globalForHub.__sendellHub;
}

export type { Hub };
