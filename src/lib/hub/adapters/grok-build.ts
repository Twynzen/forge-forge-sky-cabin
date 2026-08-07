/**
 * Grok Build adapter — SECONDARY path (API-key / stdio spawn).
 *
 * Primary product path is console linking via sendell-bridge + pairing codes
 * (subscription OAuth already done in the terminal). This file is kept so we
 * can later attach headless/API-key agents without re-architecting.
 *
 * Do not wire this as the default UI flow.
 */

import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { AcpClient } from "../acp/client";
import { MemoryTransport, StdioTransport } from "../acp/transport";
import type {
  RequestPermissionParams,
  RequestPermissionResult,
  SessionUpdateParams,
} from "../acp/types";
import type {
  ChatMessage,
  ContentBlock,
  JsonValue,
  PermissionDecisionInput,
  PlanStep,
  ProviderInfo,
  ToolCall,
  ToolKind,
} from "../types";
import type { AdapterSessionContext, CreateSessionInput, ProviderAdapter } from "./types";
import { SimulatedAcpAgent } from "./simulated-agent";

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function mapToolKind(kind?: string): ToolKind {
  const k = (kind ?? "other").toLowerCase();
  if (k.includes("read")) return "read";
  if (k.includes("edit") || k.includes("write")) return "edit";
  if (k.includes("delete")) return "delete";
  if (k.includes("move") || k.includes("rename")) return "move";
  if (k.includes("search") || k.includes("grep") || k.includes("find")) return "search";
  if (k.includes("exec") || k.includes("bash") || k.includes("shell") || k.includes("terminal"))
    return "execute";
  if (k.includes("think")) return "think";
  if (k.includes("fetch") || k.includes("http") || k.includes("web")) return "fetch";
  return "other";
}

function toJsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map(toJsonValue);
  if (typeof value === "object") {
    const out: { [key: string]: JsonValue } = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = toJsonValue(v);
    }
    return out;
  }
  return String(value);
}

function toInputRecord(raw: unknown): { [key: string]: JsonValue } | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return toJsonValue(raw) as { [key: string]: JsonValue };
  }
  return { value: toJsonValue(raw) };
}

interface LiveSession {
  client: AcpClient;
  remoteSessionId: string;
  simAgent?: SimulatedAcpAgent;
  permissionWaiters: Map<
    string,
    (decision: PermissionDecisionInput["decision"]) => void
  >;
  streamingMessageId: string | null;
  thoughtMessageId: string | null;
}

const live = new Map<string, LiveSession>();

async function commandExists(cmd: string): Promise<boolean> {
  const paths = (process.env.PATH ?? "").split(":").filter(Boolean);
  for (const dir of paths) {
    try {
      await access(`${dir}/${cmd}`, fsConstants.X_OK);
      return true;
    } catch {
      /* continue */
    }
  }
  return false;
}

export const grokBuildInfo: ProviderInfo = {
  id: "grok-build",
  name: "Grok Build",
  description: "Link live grok console (primary) · API-key spawn available later",
  available: true,
  transport: "console-bridge",
  accent: "accent",
  icon: "sparkles",
};

/**
 * Secondary adapter: spawn ACP with optional API key env on the server machine.
 * Not used by the default Link Console UI.
 */
export class GrokBuildApiKeyAdapter implements ProviderAdapter {
  readonly id = "grok-build" as const;
  readonly info = grokBuildInfo;

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async createSession(
    input: CreateSessionInput,
    ctx: AdapterSessionContext,
  ): Promise<{ remoteSessionId: string; model?: string }> {
    const forceDemo = input.demo !== false;
    const hasGrok = !forceDemo && (await commandExists("grok"));
    const cwd = input.cwd || process.cwd();

    ctx.emitStatus("connecting");

    let transport: MemoryTransport | StdioTransport;
    let simAgent: SimulatedAcpAgent | undefined;
    let demo = true;

    if (hasGrok) {
      const cmd = process.env.SENDELL_GROK_ACP_CMD || "grok";
      const args = (process.env.SENDELL_GROK_ACP_ARGS || "acp")
        .split(/\s+/)
        .filter(Boolean);
      transport = new StdioTransport(cmd, args, {
        cwd,
        env: {
          // Secondary path only — key stays on the machine, never in the phone app
          XAI_API_KEY: process.env.XAI_API_KEY,
        },
      });
      demo = false;
    } else {
      transport = new MemoryTransport();
      simAgent = new SimulatedAcpAgent(transport, input.model || "grok-api-sim");
    }

    const permissionWaiters = new Map<
      string,
      (d: PermissionDecisionInput["decision"]) => void
    >();

    const liveSession: LiveSession = {
      client: null as unknown as AcpClient,
      remoteSessionId: "",
      simAgent,
      permissionWaiters,
      streamingMessageId: null,
      thoughtMessageId: null,
    };

    const client = new AcpClient({
      transport,
      clientName: "Sendell Remote Control",
      clientVersion: "1.0.0",
      onSessionUpdate: (params) => this.onUpdate(params, ctx, liveSession),
      onPermissionRequest: (params) => this.onPermission(params, ctx, liveSession),
      onError: (err) => {
        if (!demo) ctx.emitStatus("error", err.message);
      },
      onClose: () => {
        if (ctx.meta.status !== "closed") ctx.emitStatus("disconnected");
      },
    });

    liveSession.client = client;

    try {
      await client.initialize();
      const session = await client.newSession({ cwd, mcpServers: [] });
      liveSession.remoteSessionId = session.sessionId;
      live.set(ctx.hubSessionId, liveSession);
      ctx.emitStatus("ready");
      ctx.meta.demo = demo;
      ctx.meta.remoteSessionId = session.sessionId;

      ctx.emitMessageAppended({
        id: uid("msg"),
        role: "system",
        content: [
          {
            type: "text",
            text: demo
              ? "API-key secondary path (simulated). Prefer **Link console** for subscription OAuth sessions."
              : "API-key / stdio secondary path connected. Subscription linking remains the primary product model.",
          },
        ],
        createdAt: Date.now(),
      });

      return {
        remoteSessionId: session.sessionId,
        model: input.model || (demo ? "grok-api-sim" : "grok-build"),
      };
    } catch (err) {
      simAgent?.dispose();
      client.dispose();
      ctx.emitStatus(
        "error",
        err instanceof Error ? err.message : "Failed to start Grok session",
      );
      throw err;
    }
  }

  async sendPrompt(text: string, ctx: AdapterSessionContext): Promise<void> {
    const liveSession = live.get(ctx.hubSessionId);
    if (!liveSession) throw new Error("Session not connected");

    ctx.emitMessageAppended({
      id: uid("msg"),
      role: "user",
      content: [{ type: "text", text }],
      createdAt: Date.now(),
    });
    ctx.emitStatus("thinking");
    liveSession.streamingMessageId = null;
    liveSession.thoughtMessageId = null;

    try {
      await liveSession.client.prompt({
        sessionId: liveSession.remoteSessionId,
        prompt: [{ type: "text", text }],
      });
      this.finalizeStreaming(ctx, liveSession);
      ctx.emitStatus("ready");
    } catch (err) {
      this.finalizeStreaming(ctx, liveSession);
      ctx.emitStatus("error", err instanceof Error ? err.message : "Prompt failed");
      throw err;
    }
  }

  async resolvePermission(
    input: PermissionDecisionInput,
    _ctx: AdapterSessionContext,
  ): Promise<void> {
    const liveSession = live.get(input.sessionId) || live.get(_ctx.hubSessionId);
    if (!liveSession) return;
    const waiter = liveSession.permissionWaiters.get(input.toolCallId);
    if (waiter) {
      liveSession.permissionWaiters.delete(input.toolCallId);
      waiter(input.decision);
    }
  }

  async cancel(ctx: AdapterSessionContext): Promise<void> {
    const liveSession = live.get(ctx.hubSessionId);
    if (!liveSession) return;
    liveSession.client.cancel({ sessionId: liveSession.remoteSessionId });
    this.finalizeStreaming(ctx, liveSession);
    ctx.emitStatus("ready");
  }

  async disposeSession(ctx: AdapterSessionContext): Promise<void> {
    const liveSession = live.get(ctx.hubSessionId);
    if (!liveSession) return;
    liveSession.simAgent?.dispose();
    liveSession.client.dispose();
    live.delete(ctx.hubSessionId);
  }

  private finalizeStreaming(ctx: AdapterSessionContext, liveSession: LiveSession) {
    for (const id of [liveSession.streamingMessageId, liveSession.thoughtMessageId]) {
      if (!id) continue;
      const msg = ctx.getMessages().find((m) => m.id === id);
      if (msg?.streaming) ctx.emitMessageUpdated({ ...msg, streaming: false });
    }
    liveSession.streamingMessageId = null;
    liveSession.thoughtMessageId = null;
  }

  private onUpdate(
    params: SessionUpdateParams,
    ctx: AdapterSessionContext,
    liveSession: LiveSession,
  ) {
    const u = params.update;
    switch (u.sessionUpdate) {
      case "agent_thought_chunk": {
        ctx.emitStatus("thinking");
        const text = u.content?.text ?? "";
        if (!liveSession.thoughtMessageId) {
          const msg: ChatMessage = {
            id: uid("msg"),
            role: "thought",
            content: [{ type: "text", text }],
            createdAt: Date.now(),
            streaming: true,
          };
          liveSession.thoughtMessageId = msg.id;
          ctx.emitMessageAppended(msg);
        } else {
          ctx.emitMessageChunk(liveSession.thoughtMessageId, text, "thought");
        }
        break;
      }
      case "agent_message_chunk": {
        ctx.emitStatus("streaming");
        if (liveSession.thoughtMessageId) {
          const t = ctx.getMessages().find((m) => m.id === liveSession.thoughtMessageId);
          if (t?.streaming) ctx.emitMessageUpdated({ ...t, streaming: false });
          liveSession.thoughtMessageId = null;
        }
        const text = u.content?.text ?? "";
        if (!liveSession.streamingMessageId) {
          const msg: ChatMessage = {
            id: uid("msg"),
            role: "assistant",
            content: [{ type: "text", text }],
            createdAt: Date.now(),
            streaming: true,
          };
          liveSession.streamingMessageId = msg.id;
          ctx.emitMessageAppended(msg);
        } else {
          ctx.emitMessageChunk(liveSession.streamingMessageId, text, "assistant");
        }
        break;
      }
      case "tool_call": {
        const tool: ToolCall = {
          id: u.toolCallId,
          title: u.title || "Tool call",
          kind: mapToolKind(u.kind),
          status: "pending",
          input: toInputRecord(u.rawInput),
          permissionRequired: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        ctx.emitMessageAppended({
          id: uid("msg"),
          role: "assistant",
          content: [{ type: "tool_call", toolCall: tool }],
          createdAt: Date.now(),
        });
        ctx.emitToolUpdated(tool);
        break;
      }
      case "tool_call_update": {
        const statusMap: Record<string, ToolCall["status"]> = {
          pending: "pending",
          in_progress: "running",
          completed: "completed",
          failed: "failed",
        };
        const status = statusMap[u.status ?? ""] ?? "running";
        const output =
          u.content
            ?.map((c) => c.text ?? "")
            .filter(Boolean)
            .join("\n") || undefined;
        for (const m of ctx.getMessages()) {
          for (let i = 0; i < m.content.length; i++) {
            const block = m.content[i];
            if (block.type === "tool_call" && block.toolCall.id === u.toolCallId) {
              const updated: ToolCall = {
                ...block.toolCall,
                status,
                output: output ?? block.toolCall.output,
                updatedAt: Date.now(),
              };
              const newContent: ContentBlock[] = [...m.content];
              newContent[i] = { type: "tool_call", toolCall: updated };
              ctx.emitMessageUpdated({ ...m, content: newContent });
              ctx.emitToolUpdated(updated);
              return;
            }
          }
        }
        break;
      }
      case "plan": {
        const steps: PlanStep[] = u.entries.map((e, idx) => ({
          id: `plan_${idx}`,
          title: e.content,
          status:
            e.status === "completed"
              ? "completed"
              : e.status === "in_progress"
                ? "in_progress"
                : e.status === "failed"
                  ? "failed"
                  : "pending",
        }));
        ctx.emitPlanUpdated(steps);
        break;
      }
      default:
        break;
    }
  }

  private onPermission(
    params: RequestPermissionParams,
    ctx: AdapterSessionContext,
    liveSession: LiveSession,
  ): Promise<RequestPermissionResult> {
    const toolCallId = params.toolCall.toolCallId;
    const tool: ToolCall = {
      id: toolCallId,
      title: params.toolCall.title || "Permission required",
      kind: mapToolKind(params.toolCall.kind),
      status: "awaiting_permission",
      input: toInputRecord(params.toolCall.rawInput),
      permissionRequired: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    ctx.setPendingPermission(tool);
    ctx.emitPermissionRequested(tool);
    ctx.emitStatus("awaiting_permission");

    return new Promise((resolve) => {
      liveSession.permissionWaiters.set(toolCallId, (decision) => {
        const optionId =
          decision === "allow"
            ? "allow-once"
            : decision === "allow_always"
              ? "allow-always"
              : "reject-once";
        resolve({
          outcome:
            decision === "reject"
              ? { outcome: "selected", optionId: "reject-once" }
              : { outcome: "selected", optionId },
        });
      });
    });
  }
}

export const grokBuildAdapter = new GrokBuildApiKeyAdapter();
