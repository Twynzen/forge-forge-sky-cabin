/**
 * Durable hub store — Postgres when DATABASE_URL is set, else PGLite.
 * Live bridge tokens/queues stay in memory; this keeps titles + transcripts.
 */
import { getSql } from "@/lib/db";
import type {
  ChatMessage,
  ContentBlock,
  LinkState,
  ProviderId,
  SessionMeta,
  SessionStatus,
  ToolCall,
} from "./types";

export interface PersistedSessionRow {
  meta: SessionMeta;
  messages: ChatMessage[];
  pendingPermissions: ToolCall[];
  pairingNormalized: string;
  sessionToken?: string;
}

type SessionDbRow = {
  id: string;
  title: string;
  provider_id: string;
  status: string;
  link_state: string;
  link_source: string | null;
  host_label: string | null;
  cwd: string | null;
  model: string | null;
  demo: boolean;
  pairing_code: string | null;
  meta_json: unknown;
  created_at: string | Date;
  updated_at: string | Date;
};

type MessageDbRow = {
  id: string;
  session_id: string;
  role: string;
  content_json: unknown;
  meta_json: unknown;
  streaming: boolean;
  created_at: string | Date;
};

function ts(v: string | Date | number | undefined): number {
  if (typeof v === "number") return v;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string") {
    const n = Date.parse(v);
    return Number.isFinite(n) ? n : Date.now();
  }
  return Date.now();
}

function asObject(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      if (p && typeof p === "object") return p as Record<string, unknown>;
    } catch {
      /* ignore */
    }
  }
  return {};
}

function asArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      if (Array.isArray(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return [];
}

export async function loadAllSessions(): Promise<PersistedSessionRow[]> {
  const sql = await getSql();
  const rows = await sql.query<SessionDbRow>(
    `SELECT id, title, provider_id, status, link_state, link_source,
            host_label, cwd, model, demo, pairing_code, meta_json,
            created_at, updated_at
     FROM sendell_sessions
     WHERE status <> 'closed'
     ORDER BY updated_at DESC
     LIMIT 200`,
  );

  const out: PersistedSessionRow[] = [];
  for (const r of rows) {
    const extra = asObject(r.meta_json);
    const pairingNormalized =
      typeof extra.pairingNormalized === "string"
        ? extra.pairingNormalized
        : (r.pairing_code || "").replace(/\s+/g, "").toUpperCase();
    const sessionToken =
      typeof extra.sessionToken === "string" ? extra.sessionToken : undefined;

    // After hub restart the bridge process is gone — never claim linked
    let linkState = r.link_state as LinkState;
    let status = r.status as SessionStatus;
    if (linkState === "linked" || status === "ready" || status === "thinking" || status === "streaming") {
      linkState = "disconnected";
      status = "disconnected";
    }

    const meta: SessionMeta = {
      id: r.id,
      title: r.title,
      providerId: (r.provider_id as ProviderId) || "grok-build",
      status,
      hostLabel: r.host_label || undefined,
      cwd: r.cwd || undefined,
      model: r.model || undefined,
      createdAt: ts(r.created_at),
      updatedAt: ts(r.updated_at),
      demo: Boolean(r.demo),
      pairingCode: r.pairing_code || undefined,
      linkState,
      linkSource:
        (r.link_source as SessionMeta["linkSource"]) || "phone_room",
      lastError:
        typeof extra.lastError === "string" ? extra.lastError : undefined,
      remoteSessionId:
        typeof extra.remoteSessionId === "string"
          ? extra.remoteSessionId
          : undefined,
    };

    const msgRows = await sql.query<MessageDbRow>(
      `SELECT id, session_id, role, content_json, meta_json, streaming, created_at
       FROM sendell_messages
       WHERE session_id = $1
       ORDER BY created_at ASC
       LIMIT 500`,
      [r.id],
    );

    const messages: ChatMessage[] = msgRows.map((m) => {
      const metaObj = asObject(m.meta_json);
      const content = asArray(m.content_json) as ContentBlock[];
      return {
        id: m.id,
        role: m.role as ChatMessage["role"],
        content,
        createdAt: ts(m.created_at),
        streaming: false,
        meta:
          metaObj.source === "phone" || metaObj.source === "console"
            ? { source: metaObj.source }
            : undefined,
      };
    });

    out.push({
      meta,
      messages,
      pendingPermissions: [],
      pairingNormalized,
      sessionToken,
    });
  }
  return out;
}

export async function upsertSession(
  meta: SessionMeta,
  pairingNormalized: string,
  sessionToken?: string,
): Promise<void> {
  const sql = await getSql();
  const metaJson = {
    pairingNormalized,
    sessionToken: sessionToken || null,
    lastError: meta.lastError || null,
    remoteSessionId: meta.remoteSessionId || null,
  };
  await sql.query(
    `INSERT INTO sendell_sessions (
       id, title, provider_id, status, link_state, link_source,
       host_label, cwd, model, demo, pairing_code, meta_json,
       created_at, updated_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,
       to_timestamp($13/1000.0), to_timestamp($14/1000.0)
     )
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       provider_id = EXCLUDED.provider_id,
       status = EXCLUDED.status,
       link_state = EXCLUDED.link_state,
       link_source = EXCLUDED.link_source,
       host_label = EXCLUDED.host_label,
       cwd = EXCLUDED.cwd,
       model = EXCLUDED.model,
       demo = EXCLUDED.demo,
       pairing_code = EXCLUDED.pairing_code,
       meta_json = EXCLUDED.meta_json,
       updated_at = EXCLUDED.updated_at`,
    [
      meta.id,
      meta.title,
      meta.providerId,
      meta.status,
      meta.linkState,
      meta.linkSource,
      meta.hostLabel || null,
      meta.cwd || null,
      meta.model || null,
      meta.demo,
      meta.pairingCode || null,
      JSON.stringify(metaJson),
      meta.createdAt,
      meta.updatedAt,
    ],
  );
}

export async function upsertMessage(
  sessionId: string,
  message: ChatMessage,
): Promise<void> {
  if (message.role === "system") return;
  const sql = await getSql();
  await sql.query(
    `INSERT INTO sendell_messages (
       id, session_id, role, content_json, meta_json, streaming, created_at
     ) VALUES (
       $1,$2,$3,$4::jsonb,$5::jsonb,$6, to_timestamp($7/1000.0)
     )
     ON CONFLICT (id) DO UPDATE SET
       content_json = EXCLUDED.content_json,
       meta_json = EXCLUDED.meta_json,
       streaming = EXCLUDED.streaming`,
    [
      message.id,
      sessionId,
      message.role,
      JSON.stringify(message.content),
      JSON.stringify(message.meta || {}),
      Boolean(message.streaming),
      message.createdAt,
    ],
  );
}

export async function deleteSession(sessionId: string): Promise<void> {
  const sql = await getSql();
  await sql.query(`DELETE FROM sendell_sessions WHERE id = $1`, [sessionId]);
}

/** Fire-and-forget with log; never throws to callers */
export function persistSafe(label: string, fn: () => Promise<void>): void {
  void fn().catch((err) => {
    console.error(`[sendell-persist] ${label}`, err);
  });
}
