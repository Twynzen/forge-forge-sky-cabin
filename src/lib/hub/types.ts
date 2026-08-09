/**
 * Sendell Remote Control — domain types
 *
 * Model: link already-open agent consoles (subscription CLI sessions)
 * to this hub. The phone never holds provider API keys.
 */

export type ProviderId =
  | "grok-build"
  | "claude-code"
  | "gemini"
  | "gpt"
  | "simulated";

export type SessionStatus =
  | "waiting_link"
  | "connecting"
  | "ready"
  | "thinking"
  | "streaming"
  | "awaiting_permission"
  | "error"
  | "disconnected"
  | "closed";

export type MessageRole = "user" | "assistant" | "system" | "thought";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "code"; language?: string; code: string }
  | { type: "tool_call"; toolCall: ToolCall }
  | { type: "plan"; steps: PlanStep[] }
  | {
      type: "image";
      /** Server media id */
      mediaId: string;
      mimeType: string;
      name?: string;
      /** App-relative URL e.g. /api/hub/media/xxx */
      url: string;
    };

export interface PromptImageInput {
  /** base64 (raw or data-url) — preferred for phone upload */
  base64?: string;
  mediaId?: string;
  mimeType: string;
  name?: string;
}

export interface PlanStep {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed" | "failed";
}

export type ToolCallStatus =
  | "pending"
  | "awaiting_permission"
  | "running"
  | "completed"
  | "failed"
  | "rejected";

export type ToolKind =
  | "read"
  | "edit"
  | "delete"
  | "move"
  | "search"
  | "execute"
  | "think"
  | "fetch"
  | "other";

export interface ToolCall {
  id: string;
  title: string;
  kind: ToolKind;
  status: ToolCallStatus;
  input?: { [key: string]: JsonValue };
  output?: string;
  error?: string;
  permissionRequired?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: ContentBlock[];
  createdAt: number;
  streaming?: boolean;
  /** phone | console — where the human typed */
  meta?: { source?: "phone" | "console" };
}

export type LinkState = "waiting" | "linked" | "disconnected";

export interface SessionMeta {
  id: string;
  title: string;
  providerId: ProviderId;
  status: SessionStatus;
  /** Machine / project the console is running on */
  hostLabel?: string;
  cwd?: string;
  model?: string;
  createdAt: number;
  updatedAt: number;
  lastError?: string;
  /** ACP session id inside the console process */
  remoteSessionId?: string;
  /**
   * true = demo console (simulated link in this preview).
   * false = real bridge attached from a terminal.
   */
  demo: boolean;
  /** Pairing code shown on phone or terminal */
  pairingCode?: string;
  linkState: LinkState;
  /** How the session was linked */
  linkSource: "phone_room" | "terminal_code" | "demo";
}

export interface SessionSnapshot extends SessionMeta {
  messages: ChatMessage[];
  pendingPermissions: ToolCall[];
  plan?: PlanStep[];
}

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  description: string;
  available: boolean;
  /** How this provider attaches — always console bridge, never API key in app */
  transport: "console-bridge" | "demo-bridge" | "stub";
  accent: string;
  icon: string;
}

/** Phone creates an empty room and shows a code for the console to join */
export interface CreateLinkRoomInput {
  providerId?: ProviderId;
  title?: string;
  /** Force demo-linked console for preview */
  demo?: boolean;
}

/** Phone enters a code that the console printed (e.g. after /remote) */
export interface JoinWithCodeInput {
  code: string;
}

export interface SendPromptInput {
  sessionId: string;
  text: string;
  /** Optional images from phone (max 3, each ≤2.5MB) */
  images?: PromptImageInput[];
}

export interface PermissionDecisionInput {
  sessionId: string;
  toolCallId: string;
  decision: "allow" | "allow_always" | "reject";
}

/** Bridge (running next to the agent console) registers itself */
export interface BridgePairInput {
  code: string;
  providerId: ProviderId;
  hostname: string;
  cwd: string;
  agentName?: string;
  model?: string;
  /** Optional secret for demo simulators */
  demo?: boolean;
}

export interface BridgePairResult {
  sessionId: string;
  sessionToken: string;
  providerId: ProviderId;
}

/** Commands the phone → hub queues for the bridge */
export type BridgeCommand =
  | {
      id: string;
      type: "prompt";
      text: string;
      createdAt: number;
      /** Absolute URLs the bridge can download onto the agent machine */
      images?: Array<{
        mediaId: string;
        url: string;
        mimeType: string;
        name?: string;
      }>;
    }
  | {
      id: string;
      type: "permission";
      toolCallId: string;
      decision: "allow" | "allow_always" | "reject";
      createdAt: number;
    }
  | { id: string; type: "cancel"; createdAt: number };

/** Events the bridge → hub pushes (mirrors ACP stream) */
export type BridgeEvent =
  | { type: "status"; status: SessionStatus; error?: string }
  | {
      type: "message";
      message: ChatMessage;
    }
  | {
      type: "message_update";
      message: ChatMessage;
    }
  | {
      type: "chunk";
      messageId: string;
      chunk: string;
      role: MessageRole;
    }
  | { type: "tool"; toolCall: ToolCall }
  | { type: "permission"; toolCall: ToolCall }
  | { type: "plan"; steps: PlanStep[] }
  | { type: "hello"; remoteSessionId?: string; model?: string };

export type HubEvent =
  | { type: "session.created"; session: SessionMeta }
  | { type: "session.updated"; session: SessionMeta }
  | { type: "session.removed"; sessionId: string }
  | { type: "message.appended"; sessionId: string; message: ChatMessage }
  | { type: "message.updated"; sessionId: string; message: ChatMessage }
  | {
      type: "message.chunk";
      sessionId: string;
      messageId: string;
      chunk: string;
      role: MessageRole;
    }
  | { type: "tool.updated"; sessionId: string; toolCall: ToolCall }
  | { type: "permission.requested"; sessionId: string; toolCall: ToolCall }
  | { type: "plan.updated"; sessionId: string; steps: PlanStep[] }
  | { type: "heartbeat"; ts: number };
