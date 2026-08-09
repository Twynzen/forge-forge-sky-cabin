/**
 * Sendell Hub — links open agent consoles to phone operators.
 *
 * Lifecycle:
 *   waiting  → linked (pair + heartbeat)
 *   linked   → offline (no heartbeat ~45s, e.g. Ctrl+C Grok)
 *   offline  → linked (wait/heartbeat resumes same token)
 *   offline  → removed (user deletes, or auto after ~5 min offline)
 *
 * Durability: titles + transcripts in Postgres/PGLite (sendell_* tables).
 * Live bridge tokens/queues stay in memory — after hub restart, re-pair.
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
import {
  deleteSession as dbDeleteSession,
  loadAllSessions,
  persistSafe,
  upsertMessage,
  upsertSession,
} from "./persist";
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
import {
  mediaPublicPath,
  publicHubBase,
  saveMediaBase64,
} from "./media-store";

const STALE_MS = 45_000;
const AUTO_REMOVE_MS = 5 * 60_000;
const SWEEP_MS = 8_000;

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
  offlineSince?: number;
  permissionWaiters?: Map<
    string,
    (d: "allow" | "allow_always" | "reject") => void
  >;
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
  private sweepTimer: ReturnType<typeof setInterval> | null = null;
  private hydratePromise: Promise<void>;

  constructor() {
    this.bus.setMaxListeners(200);
    this.sweepTimer = setInterval(() => this.sweepLiveness(), SWEEP_MS);
    if (typeof this.sweepTimer === "object" && this.sweepTimer && "unref" in this.sweepTimer) {
      (this.sweepTimer as NodeJS.Timeout).unref?.();
    }
    this.hydratePromise = this.hydrateFromDb().catch((err) => {
      console.error("[hub] hydrate failed", err);
    });
  }

  /** Wait until DB sessions are loaded (call from API handlers). */
  async ready(): Promise<void> {
    await this.hydratePromise;
  }

  private async hydrateFromDb(): Promise<void> {
    const rows = await loadAllSessions();
    for (const row of rows) {
      if (this.sessions.has(row.meta.id)) continue;
      const internal: InternalSession = {
        meta: row.meta,
        messages: row.messages,
        pendingPermissions: row.pendingPermissions,
        rev: 1,
        pairingNormalized: row.pairingNormalized,
        sessionToken: row.sessionToken,
        offlineSince:
          row.meta.linkState === "disconnected" ? Date.now() : undefined,
      };
      this.sessions.set(row.meta.id, internal);
      if (row.pairingNormalized) {
        this.codeIndex.set(row.pairingNormalized, row.meta.id);
      }
    }
    if (rows.length) {
      console.log(`[hub] hydrated ${rows.length} session(s) from database`);
    }
  }

  private persist(s: InternalSession) {
    persistSafe(`session ${s.meta.id}`, () =>
      upsertSession(s.meta, s.pairingNormalized, s.sessionToken),
    );
  }

  private persistMsg(sessionId: string, message: ChatMessage) {
    persistSafe(`message ${message.id}`, () =>
      upsertMessage(sessionId, message),
    );
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
    this.persist(session);
  }

  private isBridgeLive(sessionId: string): boolean {
    const conn = getBridgeBySession(sessionId);
    if (!conn) return false;
    return Date.now() - conn.lastSeenAt < STALE_MS;
  }

  private applyLiveness(s: InternalSession): void {
    if (s.meta.demo) return;
    if (!s.sessionToken) return;

    const live = this.isBridgeLive(s.meta.id);

    if (live) {
      s.offlineSince = undefined;
      if (s.meta.linkState === "disconnected" || s.meta.status === "disconnected") {
        this.touch(s, { linkState: "linked", status: "ready" });
      }
      return;
    }

    if (
      s.meta.linkState === "linked" ||
      s.meta.status === "ready" ||
      s.meta.status === "thinking" ||
      s.meta.status === "streaming"
    ) {
      if (!s.offlineSince) s.offlineSince = Date.now();
      this.touch(s, { linkState: "disconnected", status: "disconnected" });
    } else if (s.meta.linkState === "disconnected" && !s.offlineSince) {
      s.offlineSince = Date.now();
    }
  }

  private sweepLiveness(): void {
    const toRemove: string[] = [];
    for (const s of this.sessions.values()) {
      this.applyLiveness(s);
      // NEVER auto-delete linked/disconnected sessions — they live in Postgres
      // until the user taps "Remove from app". (Old 5-min purge wiped history.)
      if (
        s.meta.linkState === "waiting" &&
        s.messages.length === 0 &&
        Date.now() - s.meta.createdAt > 15 * 60_000
      ) {
        // Only empty unpaired rooms expire
        toRemove.push(s.meta.id);
      }
    }
    for (const id of toRemove) {
      void this.closeSession(id);
    }
  }

  listProviders(): ProviderInfo[] {
    return PROVIDERS.map((p) => ({ ...p }));
  }

  listSessions(): SessionMeta[] {
    this.sweepLiveness();
    return Array.from(this.sessions.values())
      .filter((s) => s.meta.linkState !== "waiting")
      .map((s) => ({ ...s.meta }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getSnapshot(sessionId: string): SessionSnapshot | null {
    const s = this.sessions.get(sessionId);
    if (!s) return null;
    this.applyLiveness(s);
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

  private startDemo(sessionId: string, text: string) {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    s.demoAbort?.abort();
    const ac = new AbortController();
    s.demoAbort = ac;
    if (!s.permissionWaiters) s.permissionWaiters = new Map();

    void runDemoConsoleAgent({
      text,
      signal: ac.signal,
      emit: (ev) => this.applyBridgeEvent(sessionId, ev),
      waitPermission: (toolCallId) =>
        new Promise((resolve) => {
          s.permissionWaiters!.set(toolCallId, resolve);
        }),
    }).catch(() => {
      /* aborted */
    });
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
    this.persist(internal);

    if (demo) {
      const token = uid("tok");
      internal.sessionToken = token;
      registerBridge(id, token);
      this.persist(internal);
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
      pairingCode: formatPairingCode(code),
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
    this.persist(internal);
    return this.getSnapshot(id)!;
  }

  pairBridge(input: BridgePairInput): BridgePairResult {
    const normalized = normalizePairingCode(input.code);
    let sessionId = this.codeIndex.get(normalized);
    if (!sessionId) {
      const snap = this.joinWithCode(input.code);
      sessionId = snap.id;
    }
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error("Room not found");

    const token = uid("tok");
    s.sessionToken = token;
    registerBridge(sessionId, token);

    const host = input.hostname || "console";
    const cwd = input.cwd || "";
    const title =
      cwd.split(/[/\\]/).filter(Boolean).pop() ||
      input.agentName ||
      "Linked console";

    this.touch(s, {
      title,
      hostLabel: host,
      cwd: cwd || undefined,
      model: input.model || input.agentName || s.meta.model,
      providerId: (input.providerId as ProviderId) || s.meta.providerId,
      status: "ready",
      linkState: "linked",
      demo: input.demo === true,
    });
    s.offlineSince = undefined;

    return {
      sessionId,
      sessionToken: token,
      providerId: s.meta.providerId,
    };
  }

  async sendPrompt(input: SendPromptInput): Promise<void> {
    const s = this.sessions.get(input.sessionId);
    if (!s) throw new Error("Session not found");
    this.applyLiveness(s);

    if (s.meta.linkState === "waiting") {
      throw new Error("Console not linked yet");
    }
    if (s.meta.linkState === "disconnected" || s.meta.status === "disconnected") {
      throw new Error(
        "Console offline — resume Grok wait (or rc CODE) so heartbeats return",
      );
    }
    if (s.meta.status === "closed") throw new Error("Session closed");

    const content: import("./types").ContentBlock[] = [];
    const text = (input.text || "").trim();
    if (text) content.push({ type: "text", text });

    const bridgeImages: Array<{
      mediaId: string;
      url: string;
      mimeType: string;
      name?: string;
    }> = [];

    const imgs = (input.images || []).slice(0, 3);
    for (const img of imgs) {
      let mediaId = img.mediaId;
      let mime = img.mimeType || "image/jpeg";
      let name = img.name;
      if (!mediaId && img.base64) {
        const stored = saveMediaBase64({
          base64: img.base64,
          mimeType: mime,
          name,
        });
        mediaId = stored.id;
        mime = stored.mimeType;
        name = stored.name;
      }
      if (!mediaId) continue;
      const rel = mediaPublicPath(mediaId);
      content.push({
        type: "image",
        mediaId,
        mimeType: mime,
        name,
        url: rel,
      });
      const base = publicHubBase();
      const abs = base ? `${base}${rel}` : rel;
      bridgeImages.push({ mediaId, url: abs, mimeType: mime, name });
    }

    if (!content.length) throw new Error("Empty message");

    const userMsg: ChatMessage = {
      id: uid("msg"),
      role: "user",
      content,
      createdAt: Date.now(),
      meta: { source: "phone" },
    };
    s.messages.push(userMsg);
    this.emit({ type: "message.appended", sessionId: s.meta.id, message: userMsg });
    this.persistMsg(s.meta.id, userMsg);
    this.touch(s, { status: "thinking" });

    const plainForDemo =
      text ||
      (bridgeImages.length ? `[${bridgeImages.length} image(s)]` : "");

    if (s.meta.demo) {
      this.startDemo(s.meta.id, plainForDemo);
      return;
    }

    if (!this.isBridgeLive(s.meta.id)) {
      this.touch(s, { linkState: "disconnected", status: "disconnected" });
      throw new Error("Console offline");
    }

    // Text the agent sees + note about local image paths (bridge downloads)
    let agentText = text;
    if (bridgeImages.length) {
      const note = bridgeImages
        .map((i, n) => `Image ${n + 1}: will be saved by sendell-remote (media ${i.mediaId})`)
        .join("\n");
      agentText = agentText
        ? `${agentText}\n\n${note}`
        : `User sent ${bridgeImages.length} image(s).\n${note}`;
    }

    enqueueCommand(s.meta.id, {
      id: makeCommandId(),
      type: "prompt",
      text: agentText,
      createdAt: Date.now(),
      images: bridgeImages.length ? bridgeImages : undefined,
    });
  }

  async resolvePermission(input: PermissionDecisionInput): Promise<void> {
    const s = this.sessions.get(input.sessionId);
    if (!s) throw new Error("Session not found");
    s.pendingPermissions = s.pendingPermissions.filter((t) => t.id !== input.toolCallId);

    const waiter = s.permissionWaiters?.get(input.toolCallId);
    if (waiter) {
      s.permissionWaiters!.delete(input.toolCallId);
      waiter(input.decision);
    } else {
      enqueueCommand(s.meta.id, {
        id: makeCommandId(),
        type: "permission",
        toolCallId: input.toolCallId,
        decision: input.decision,
        createdAt: Date.now(),
      });
    }
    this.touch(s, { status: s.meta.linkState === "linked" ? "ready" : s.meta.status });
  }

  async cancelSession(sessionId: string): Promise<void> {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    s.demoAbort?.abort();
    enqueueCommand(sessionId, {
      id: makeCommandId(),
      type: "cancel",
      createdAt: Date.now(),
    });
    this.touch(s, { status: s.meta.linkState === "linked" ? "ready" : s.meta.status });
  }

  renameSession(sessionId: string, title: string): SessionSnapshot {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error("Session not found");
    const next = title.trim().slice(0, 80);
    if (!next) throw new Error("Title required");
    this.touch(s, { title: next });
    return this.getSnapshot(sessionId)!;
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
    persistSafe(`delete ${sessionId}`, () => dbDeleteSession(sessionId));
  }

  async bridgePollCommands(sessionToken: string, timeoutMs = 25000) {
    const conn = getBridgeByToken(sessionToken);
    if (!conn) throw new Error("Invalid session token");
    touchBridge(conn.sessionId);
    const s = this.sessions.get(conn.sessionId);
    if (s) {
      s.offlineSince = undefined;
      if (s.meta.linkState === "disconnected") {
        this.touch(s, { linkState: "linked", status: "ready" });
      }
    }
    return waitForCommands(conn.sessionId, timeoutMs);
  }

  applyBridgeEvents(sessionToken: string, events: BridgeEvent[]): void {
    const conn = getBridgeByToken(sessionToken);
    if (!conn) throw new Error("Invalid session token");
    touchBridge(conn.sessionId);
    const s = this.sessions.get(conn.sessionId);
    if (s) {
      s.offlineSince = undefined;
      if (s.meta.linkState === "disconnected") {
        this.touch(s, { linkState: "linked", status: "ready" });
      }
    }
    for (const ev of events) {
      this.applyBridgeEvent(conn.sessionId, ev);
    }
  }

  bridgeHeartbeat(sessionToken: string): { ok: true; sessionId: string } {
    const conn = getBridgeByToken(sessionToken);
    if (!conn) throw new Error("Invalid session token");
    touchBridge(conn.sessionId);
    const s = this.sessions.get(conn.sessionId);
    if (s) {
      s.offlineSince = undefined;
      if (s.meta.linkState === "disconnected" || s.meta.status === "disconnected") {
        this.touch(s, { linkState: "linked", status: "ready" });
      }
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
        break;
      case "status":
        this.touch(s, { status: ev.status, lastError: ev.error });
        break;
      case "message":
        if (ev.message.role === "system") {
          this.touch(s, {});
          break;
        }
        s.messages.push(ev.message);
        this.emit({ type: "message.appended", sessionId, message: ev.message });
        this.persistMsg(sessionId, ev.message);
        this.touch(s, {});
        break;
      case "message_update": {
        const idx = s.messages.findIndex((m) => m.id === ev.message.id);
        if (idx >= 0) s.messages[idx] = ev.message;
        this.emit({ type: "message.updated", sessionId, message: ev.message });
        this.persistMsg(sessionId, ev.message);
        break;
      }
      case "chunk": {
        const msg = s.messages.find((m) => m.id === ev.messageId);
        if (msg) {
          const textBlock = msg.content.find((c) => c.type === "text");
          if (textBlock && textBlock.type === "text") textBlock.text += ev.chunk;
          msg.streaming = true;
          this.emit({ type: "message.updated", sessionId, message: msg });
        }
        break;
      }
      case "tool": {
        const tool = ev.toolCall;
        if (tool.status === "pending") {
          s.pendingPermissions = [
            ...s.pendingPermissions.filter((t) => t.id !== tool.id),
            tool,
          ];
          this.touch(s, { status: "awaiting_permission" });
        }
        this.emit({ type: "tool.updated", sessionId, toolCall: tool });
        break;
      }
      case "plan":
        s.plan = ev.steps;
        this.touch(s, {});
        break;
      default:
        break;
    }
  }

  ensureDemoSession(): void {
    /* no-op */
  }
}

const g = globalThis as unknown as {
  __sendellHub?: Hub;
  __sendellHubReady?: Promise<void>;
};

export function getHub(): Hub {
  if (!g.__sendellHub) {
    g.__sendellHub = new Hub();
    g.__sendellHubReady = g.__sendellHub.ready();
  }
  return g.__sendellHub;
}

/** Prefer in API handlers so list/snapshot see hydrated DB rows. */
export async function getHubReady(): Promise<Hub> {
  const h = getHub();
  await h.ready();
  return h;
}
