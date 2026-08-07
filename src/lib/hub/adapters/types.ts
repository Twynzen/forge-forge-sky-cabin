/**
 * Provider Adapter interface — extension point for attach modes.
 *
 * Primary product path: console bridge (subscription OAuth session).
 * Secondary: spawn/API-key adapters (kept for later automation).
 */

import type {
  ChatMessage,
  PermissionDecisionInput,
  PlanStep,
  ProviderId,
  ProviderInfo,
  SessionMeta,
  SessionStatus,
  ToolCall,
} from "../types";

/** Optional spawn/API-key create input (secondary path) */
export interface CreateSessionInput {
  providerId: ProviderId;
  title?: string;
  cwd?: string;
  model?: string;
  demo?: boolean;
  /** When true, prefer API-key/stdio spawn instead of link-only */
  useApiKeyPath?: boolean;
}

export interface AdapterSessionContext {
  hubSessionId: string;
  meta: SessionMeta;
  emitMessageAppended: (message: ChatMessage) => void;
  emitMessageUpdated: (message: ChatMessage) => void;
  emitMessageChunk: (
    messageId: string,
    chunk: string,
    role: ChatMessage["role"],
  ) => void;
  emitToolUpdated: (toolCall: ToolCall) => void;
  emitPermissionRequested: (toolCall: ToolCall) => void;
  emitPlanUpdated: (steps: PlanStep[]) => void;
  emitStatus: (status: SessionStatus, error?: string) => void;
  getMessages: () => ChatMessage[];
  getPendingPermissions: () => ToolCall[];
  setPendingPermission: (tool: ToolCall | null) => void;
}

export interface ProviderAdapter {
  readonly id: ProviderId;
  readonly info: ProviderInfo;

  isAvailable(): Promise<boolean>;

  createSession(
    input: CreateSessionInput,
    ctx: AdapterSessionContext,
  ): Promise<{ remoteSessionId: string; model?: string }>;

  sendPrompt(text: string, ctx: AdapterSessionContext): Promise<void>;

  resolvePermission?(
    input: PermissionDecisionInput,
    ctx: AdapterSessionContext,
  ): Promise<void>;

  cancel?(ctx: AdapterSessionContext): Promise<void>;

  disposeSession?(ctx: AdapterSessionContext): Promise<void>;
}
