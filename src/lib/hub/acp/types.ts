/**
 * Agent Client Protocol (ACP) — JSON-RPC 2.0 types
 * Spec-aligned subset used by Sendell Hub adapters.
 * @see https://agentclientprotocol.com
 */

export const ACP_PROTOCOL_VERSION = 1;

export interface JsonRpcRequest<T = unknown> {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: T;
}

export interface JsonRpcNotification<T = unknown> {
  jsonrpc: "2.0";
  method: string;
  params?: T;
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: number | string;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

export type JsonRpcMessage =
  | JsonRpcRequest
  | JsonRpcNotification
  | JsonRpcResponse;

// --- initialize ---

export interface InitializeParams {
  protocolVersion: number;
  clientInfo: { name: string; version: string };
  capabilities?: {
    fs?: { readTextFile?: boolean; writeTextFile?: boolean };
    terminal?: boolean;
  };
}

export interface InitializeResult {
  protocolVersion: number;
  agentCapabilities?: {
    loadSession?: boolean;
    promptCapabilities?: { image?: boolean; audio?: boolean; embeddedContext?: boolean };
  };
  agentInfo?: { name?: string; version?: string };
  authMethods?: Array<{ id: string; name?: string }>;
}

// --- session ---

export interface SessionNewParams {
  cwd: string;
  mcpServers?: unknown[];
}

export interface SessionNewResult {
  sessionId: string;
  modes?: {
    currentModeId?: string;
    availableModes?: Array<{ id: string; name: string; description?: string }>;
  };
}

export interface SessionPromptParams {
  sessionId: string;
  prompt: Array<
    | { type: "text"; text: string }
    | { type: "resource"; uri: string; mimeType?: string; text?: string }
    | { type: "image"; data: string; mimeType: string }
  >;
}

export interface SessionPromptResult {
  stopReason: "end_turn" | "max_tokens" | "cancelled" | "refusal" | string;
}

export interface SessionCancelParams {
  sessionId: string;
}

// --- session/update (agent → client notification) ---

export type SessionUpdate =
  | { sessionUpdate: "agent_message_chunk"; content: { type: "text"; text: string } }
  | { sessionUpdate: "agent_thought_chunk"; content: { type: "text"; text: string } }
  | { sessionUpdate: "user_message_chunk"; content: { type: "text"; text: string } }
  | {
      sessionUpdate: "tool_call";
      toolCallId: string;
      title?: string;
      kind?: string;
      status?: string;
      rawInput?: unknown;
      content?: Array<{ type: string; text?: string }>;
      locations?: Array<{ path: string }>;
    }
  | {
      sessionUpdate: "tool_call_update";
      toolCallId: string;
      status?: string;
      title?: string;
      content?: Array<{ type: string; text?: string }>;
      rawOutput?: unknown;
    }
  | {
      sessionUpdate: "plan";
      entries: Array<{ content: string; status: string; priority?: string }>;
    }
  | {
      sessionUpdate: "available_commands_update";
      availableCommands: Array<{ name: string; description?: string }>;
    }
  | {
      sessionUpdate: "current_mode_update";
      currentModeId: string;
    };

export interface SessionUpdateParams {
  sessionId: string;
  update: SessionUpdate;
}

// --- session/request_permission (agent → client request) ---

export interface PermissionOption {
  optionId: string;
  name: string;
  kind: "allow_once" | "allow_always" | "reject_once" | "reject_always" | string;
}

export interface RequestPermissionParams {
  sessionId: string;
  toolCall: {
    toolCallId: string;
    title?: string;
    kind?: string;
    status?: string;
    rawInput?: unknown;
  };
  options: PermissionOption[];
}

export interface RequestPermissionResult {
  outcome:
    | { outcome: "selected"; optionId: string }
    | { outcome: "cancelled" };
}

// --- client methods agents may call ---

export interface FsReadParams {
  path: string;
  sessionId?: string;
  line?: number;
  limit?: number;
}

export interface FsWriteParams {
  path: string;
  content: string;
  sessionId?: string;
}
