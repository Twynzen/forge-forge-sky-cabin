/**
 * In-memory bridge session tokens & command queues.
 * Liveness = lastSeenAt (heartbeat / long-poll). When Grok/Ctrl+C dies,
 * lastSeenAt ages out and the hub marks the console offline.
 */

import type { BridgeCommand } from "./types";

export interface BridgeConnection {
  sessionId: string;
  sessionToken: string;
  lastSeenAt: number;
  commandQueue: BridgeCommand[];
  waiters: Array<(cmds: BridgeCommand[]) => void>;
}

const globalStore = globalThis as unknown as {
  __sendellBridges?: Map<string, BridgeConnection>;
  __sendellTokenIndex?: Map<string, string>;
};

function bridges() {
  if (!globalStore.__sendellBridges) {
    globalStore.__sendellBridges = new Map();
  }
  return globalStore.__sendellBridges;
}

function tokenIndex() {
  if (!globalStore.__sendellTokenIndex) {
    globalStore.__sendellTokenIndex = new Map();
  }
  return globalStore.__sendellTokenIndex;
}

export function registerBridge(sessionId: string, sessionToken: string): BridgeConnection {
  const existing = bridges().get(sessionId);
  if (existing) {
    tokenIndex().delete(existing.sessionToken);
  }
  const conn: BridgeConnection = {
    sessionId,
    sessionToken,
    lastSeenAt: Date.now(),
    commandQueue: existing?.commandQueue ?? [],
    waiters: [],
  };
  bridges().set(sessionId, conn);
  tokenIndex().set(sessionToken, sessionId);
  return conn;
}

export function getBridgeByToken(token: string): BridgeConnection | null {
  const sid = tokenIndex().get(token);
  if (!sid) return null;
  return bridges().get(sid) ?? null;
}

export function getBridgeBySession(sessionId: string): BridgeConnection | null {
  return bridges().get(sessionId) ?? null;
}

export function listBridges(): BridgeConnection[] {
  return Array.from(bridges().values());
}

export function unregisterBridge(sessionId: string): void {
  const conn = bridges().get(sessionId);
  if (!conn) return;
  tokenIndex().delete(conn.sessionToken);
  bridges().delete(sessionId);
  for (const w of conn.waiters) w([]);
  conn.waiters = [];
}

export function enqueueCommand(sessionId: string, cmd: BridgeCommand): void {
  const conn = bridges().get(sessionId);
  if (!conn) return;
  conn.commandQueue.push(cmd);
  if (conn.waiters.length) {
    const waiters = conn.waiters.splice(0);
    const batch = conn.commandQueue.splice(0);
    for (const w of waiters) w(batch);
  }
}

export function waitForCommands(
  sessionId: string,
  timeoutMs = 25000,
): Promise<BridgeCommand[]> {
  const conn = bridges().get(sessionId);
  if (!conn) return Promise.resolve([]);

  conn.lastSeenAt = Date.now();

  if (conn.commandQueue.length) {
    return Promise.resolve(conn.commandQueue.splice(0));
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      const idx = conn.waiters.indexOf(onData);
      if (idx >= 0) conn.waiters.splice(idx, 1);
      resolve([]);
    }, timeoutMs);

    const onData = (cmds: BridgeCommand[]) => {
      clearTimeout(timer);
      resolve(cmds);
    };
    conn.waiters.push(onData);
  });
}

export function touchBridge(sessionId: string): void {
  const conn = bridges().get(sessionId);
  if (conn) conn.lastSeenAt = Date.now();
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function makeCommandId() {
  return uid("cmd");
}
