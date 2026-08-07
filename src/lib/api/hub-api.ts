/**
 * Client hub API — plain fetch to /api/hub/*
 * (Replaces createServerFn to avoid Invalid server function ID on Vite/Windows.)
 */

import type {
  CreateLinkRoomInput,
  JoinWithCodeInput,
  PermissionDecisionInput,
  ProviderInfo,
  SendPromptInput,
  SessionMeta,
  SessionSnapshot,
} from "../hub/types";

async function api<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>),
  };
  let body = init?.body;
  if (init?.json !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(init.json);
  }
  const res = await fetch(path, { ...init, headers, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error || `${res.status} ${path}`,
    );
  }
  return data as T;
}

/** Compatible call shapes with previous createServerFn usage */
export async function listProvidersFn(): Promise<ProviderInfo[]> {
  return api("/api/hub/providers");
}

export async function listSessionsFn(): Promise<SessionMeta[]> {
  return api("/api/hub/sessions");
}

export async function getSessionFn(opts: {
  data: { sessionId: string };
}): Promise<SessionSnapshot> {
  return api(
    `/api/hub/session?id=${encodeURIComponent(opts.data.sessionId)}`,
  );
}

export async function createLinkRoomFn(opts: {
  data: CreateLinkRoomInput;
}): Promise<SessionSnapshot> {
  return api("/api/hub/room", { method: "POST", json: opts.data });
}

export async function joinWithCodeFn(opts: {
  data: JoinWithCodeInput;
}): Promise<SessionSnapshot> {
  return api("/api/hub/join", { method: "POST", json: opts.data });
}

export async function startPromptFn(opts: {
  data: SendPromptInput;
}): Promise<{ ok: true; started: true }> {
  return api("/api/hub/prompt", { method: "POST", json: opts.data });
}

export async function sendPromptFn(opts: {
  data: SendPromptInput;
}): Promise<{ ok: true }> {
  return api("/api/hub/prompt", { method: "POST", json: opts.data });
}

export async function resolvePermissionFn(opts: {
  data: PermissionDecisionInput;
}): Promise<{ ok: true }> {
  return api("/api/hub/permission", { method: "POST", json: opts.data });
}

export async function cancelSessionFn(opts: {
  data: { sessionId: string };
}): Promise<{ ok: true }> {
  return api("/api/hub/cancel", { method: "POST", json: opts.data });
}

export async function closeSessionFn(opts: {
  data: { sessionId: string };
}): Promise<{ ok: true }> {
  return api("/api/hub/close", { method: "POST", json: opts.data });
}

export async function renameSessionFn(opts: {
  data: { sessionId: string; title: string };
}): Promise<SessionSnapshot> {
  return api("/api/hub/rename", { method: "POST", json: opts.data });
}
