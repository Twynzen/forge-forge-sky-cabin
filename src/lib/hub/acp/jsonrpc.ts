/**
 * Minimal JSON-RPC 2.0 helpers for ACP line-delimited transport.
 */

import type { JsonRpcMessage, JsonRpcNotification, JsonRpcRequest, JsonRpcResponse } from "./types";

let nextId = 1;

export function createRequestId(): number {
  return nextId++;
}

export function makeRequest<T>(method: string, params?: T, id?: number | string): JsonRpcRequest<T> {
  return {
    jsonrpc: "2.0",
    id: id ?? createRequestId(),
    method,
    params,
  };
}

export function makeNotification<T>(method: string, params?: T): JsonRpcNotification<T> {
  return {
    jsonrpc: "2.0",
    method,
    params,
  };
}

export function makeResult<T>(id: number | string, result: T): JsonRpcResponse<T> {
  return { jsonrpc: "2.0", id, result };
}

export function makeError(
  id: number | string | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id: id ?? 0,
    error: { code, message, data },
  };
}

export function parseMessage(line: string): JsonRpcMessage | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as JsonRpcMessage;
  } catch {
    return null;
  }
}

export function serializeMessage(msg: JsonRpcMessage): string {
  return JSON.stringify(msg) + "\n";
}

export function isRequest(msg: JsonRpcMessage): msg is JsonRpcRequest {
  return "method" in msg && "id" in msg && msg.id !== undefined;
}

export function isNotification(msg: JsonRpcMessage): msg is JsonRpcNotification {
  return "method" in msg && !("id" in msg);
}

export function isResponse(msg: JsonRpcMessage): msg is JsonRpcResponse {
  return "id" in msg && !("method" in msg);
}
