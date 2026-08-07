/**
 * Simulated ACP Agent — full protocol walkthrough for demos.
 * Implements agent-side JSON-RPC over MemoryTransport so the real
 * AcpClient code path is exercised end-to-end.
 */

import type { MemoryTransport } from "../acp/transport";
import type {
  JsonRpcMessage,
  JsonRpcRequest,
  RequestPermissionParams,
  SessionUpdate,
} from "../acp/types";
import {
  isNotification,
  isRequest,
  makeNotification,
  makeResult,
} from "../acp/jsonrpc";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Very small “agent” that answers coding-style prompts with tools */
export class SimulatedAcpAgent {
  private transport: MemoryTransport;
  private sessions = new Set<string>();
  private cancelled = new Set<string>();
  private unsub: (() => void) | null = null;
  private model: string;

  constructor(transport: MemoryTransport, model = "grok-build-sim") {
    this.transport = transport;
    this.model = model;
    this.unsub = transport.onAgentMessage((msg) => {
      void this.handle(msg);
    });
  }

  dispose() {
    this.unsub?.();
    this.unsub = null;
  }

  private async handle(msg: JsonRpcMessage) {
    if (isNotification(msg)) {
      if (msg.method === "session/cancel") {
        const sid = (msg.params as { sessionId?: string })?.sessionId;
        if (sid) this.cancelled.add(sid);
      }
      return;
    }
    if (!isRequest(msg)) return;

    switch (msg.method) {
      case "initialize":
        this.transport.agentSend(
          makeResult(msg.id, {
            protocolVersion: 1,
            agentCapabilities: {
              loadSession: false,
              promptCapabilities: { image: false, audio: false },
            },
            agentInfo: { name: "Grok Build (Simulated)", version: "1.0.0-sim" },
            authMethods: [],
          }),
        );
        return;
      case "session/new": {
        const sessionId = uid("acp");
        this.sessions.add(sessionId);
        this.transport.agentSend(makeResult(msg.id, { sessionId }));
        return;
      }
      case "session/prompt":
        await this.handlePrompt(msg);
        return;
      default:
        this.transport.agentSend(
          makeResult(msg.id, { ok: true }),
        );
    }
  }

  private emitUpdate(sessionId: string, update: SessionUpdate) {
    this.transport.agentSend(
      makeNotification("session/update", { sessionId, update }),
    );
  }

  private async streamText(
    sessionId: string,
    kind: "agent_message_chunk" | "agent_thought_chunk",
    text: string,
    delayMs = 18,
  ) {
    const words = text.split(/(\s+)/);
    for (const w of words) {
      if (this.cancelled.has(sessionId)) return;
      this.emitUpdate(sessionId, {
        sessionUpdate: kind,
        content: { type: "text", text: w },
      });
      await sleep(delayMs);
    }
  }

  private async requestPermission(
    sessionId: string,
    toolCallId: string,
    title: string,
    kind: string,
    rawInput: unknown,
  ): Promise<"allow" | "reject"> {
    const params: RequestPermissionParams = {
      sessionId,
      toolCall: {
        toolCallId,
        title,
        kind,
        status: "pending",
        rawInput,
      },
      options: [
        { optionId: "allow-once", name: "Allow once", kind: "allow_once" },
        { optionId: "allow-always", name: "Allow always", kind: "allow_always" },
        { optionId: "reject-once", name: "Reject", kind: "reject_once" },
      ],
    };

    return new Promise((resolve) => {
      const id = uid("perm");
      const unsub = this.transport.onAgentMessage((msg) => {
        if (!isRequest(msg) && "id" in msg && msg.id === id) {
          // response comes to agent via agentHandlers? Actually client responds
          // via transport.send which goes to agentHandlers. But responses don't
          // have method. We need to listen on agent side for responses.
        }
      });
      // Use a dedicated pending map via one-shot listener on raw agent channel
      void unsub;

      const onResp = (msg: JsonRpcMessage) => {
        if (!("id" in msg) || msg.id !== id) return;
        this.transport.onAgentMessage(() => {});
        // remove by wrapping — MemoryTransport doesn't have off for one-shot easily
        // so we check and resolve
        const result = (msg as { result?: { outcome?: { outcome?: string; optionId?: string } } })
          .result;
        const optionId = result?.outcome?.optionId ?? "";
        const rejected =
          result?.outcome?.outcome === "cancelled" ||
          optionId.startsWith("reject");
        cleanup();
        resolve(rejected ? "reject" : "allow");
      };

      // Subscribe temporarily
      const cleanupInner = this.transport.onAgentMessage(onResp);
      const cleanup = () => cleanupInner();

      // Send request agent → client (agentSend goes to client)
      // But request_permission is agent→client REQUEST, so use agentSend
      this.transport.agentSend({
        jsonrpc: "2.0",
        id,
        method: "session/request_permission",
        params,
      });
    });
  }

  private async handlePrompt(msg: JsonRpcRequest) {
    const params = msg.params as {
      sessionId: string;
      prompt: Array<{ type: string; text?: string }>;
    };
    const sessionId = params.sessionId;
    this.cancelled.delete(sessionId);

    const userText =
      params.prompt
        ?.filter((p) => p.type === "text")
        .map((p) => p.text ?? "")
        .join("\n")
        .trim() || "(empty)";

    try {
      // Plan
      this.emitUpdate(sessionId, {
        sessionUpdate: "plan",
        entries: [
          { content: "Understand the request", status: "in_progress", priority: "high" },
          { content: "Inspect relevant files", status: "pending", priority: "medium" },
          { content: "Apply changes / answer", status: "pending", priority: "high" },
        ],
      });

      await this.streamText(
        sessionId,
        "agent_thought_chunk",
        `Analyzing request for ${this.model}: "${userText.slice(0, 120)}${userText.length > 120 ? "…" : ""}". I'll inspect the workspace and respond with a concrete plan.`,
        12,
      );

      if (this.cancelled.has(sessionId)) {
        this.transport.agentSend(
          makeResult(msg.id, { stopReason: "cancelled" }),
        );
        return;
      }

      // Tool call: read
      const readId = uid("tool");
      this.emitUpdate(sessionId, {
        sessionUpdate: "tool_call",
        toolCallId: readId,
        title: "Read project structure",
        kind: "read",
        status: "pending",
        rawInput: { path: "/workspace", recursive: true },
        locations: [{ path: "/workspace" }],
      });

      const decision = await this.requestPermission(
        sessionId,
        readId,
        "Read project structure",
        "read",
        { path: "/workspace", recursive: true },
      );

      if (decision === "reject") {
        this.emitUpdate(sessionId, {
          sessionUpdate: "tool_call_update",
          toolCallId: readId,
          status: "failed",
          content: [{ type: "content", text: "Permission denied by operator" }],
        });
        await this.streamText(
          sessionId,
          "agent_message_chunk",
          "I couldn't inspect the workspace because the tool call was rejected. Tell me what you need and I'll answer from context alone, or approve a read so I can dig into the code.",
          14,
        );
        this.transport.agentSend(makeResult(msg.id, { stopReason: "end_turn" }));
        return;
      }

      this.emitUpdate(sessionId, {
        sessionUpdate: "tool_call_update",
        toolCallId: readId,
        status: "in_progress",
      });
      await sleep(400);
      this.emitUpdate(sessionId, {
        sessionUpdate: "tool_call_update",
        toolCallId: readId,
        status: "completed",
        content: [
          {
            type: "content",
            text: "src/\n  routes/\n  lib/hub/\n  components/sendell/\npackage.json\nREADME.md",
          },
        ],
      });

      // Maybe a second tool for write-like prompts
      const wantsWrite =
        /\b(fix|edit|change|implement|add|create|refactor|write)\b/i.test(
          userText,
        );

      if (wantsWrite) {
        const editId = uid("tool");
        this.emitUpdate(sessionId, {
          sessionUpdate: "tool_call",
          toolCallId: editId,
          title: "Propose code edit",
          kind: "edit",
          status: "pending",
          rawInput: {
            path: "src/lib/hub/hub.ts",
            description: "Apply requested change",
          },
          locations: [{ path: "src/lib/hub/hub.ts" }],
        });

        const editDecision = await this.requestPermission(
          sessionId,
          editId,
          "Propose code edit",
          "edit",
          { path: "src/lib/hub/hub.ts" },
        );

        if (editDecision === "allow") {
          this.emitUpdate(sessionId, {
            sessionUpdate: "tool_call_update",
            toolCallId: editId,
            status: "completed",
            content: [
              {
                type: "diff",
                text: "@@ -1,3 +1,5 @@\n+// applied by Sendell Remote Control demo\n",
              },
            ],
          });
        } else {
          this.emitUpdate(sessionId, {
            sessionUpdate: "tool_call_update",
            toolCallId: editId,
            status: "failed",
            content: [{ type: "content", text: "Edit rejected" }],
          });
        }
      }

      this.emitUpdate(sessionId, {
        sessionUpdate: "plan",
        entries: [
          { content: "Understand the request", status: "completed", priority: "high" },
          { content: "Inspect relevant files", status: "completed", priority: "medium" },
          { content: "Apply changes / answer", status: "in_progress", priority: "high" },
        ],
      });

      const answer = buildSimulatedAnswer(userText, wantsWrite);
      await this.streamText(sessionId, "agent_message_chunk", answer, 16);

      this.emitUpdate(sessionId, {
        sessionUpdate: "plan",
        entries: [
          { content: "Understand the request", status: "completed", priority: "high" },
          { content: "Inspect relevant files", status: "completed", priority: "medium" },
          { content: "Apply changes / answer", status: "completed", priority: "high" },
        ],
      });

      this.transport.agentSend(
        makeResult(msg.id, {
          stopReason: this.cancelled.has(sessionId) ? "cancelled" : "end_turn",
        }),
      );
    } catch (err) {
      this.transport.agentSend({
        jsonrpc: "2.0",
        id: msg.id,
        error: {
          code: -32000,
          message: err instanceof Error ? err.message : "Simulated agent error",
        },
      });
    }
  }
}

function buildSimulatedAnswer(userText: string, wantsWrite: boolean): string {
  const intro =
    "I'm **Grok Build** running through **Sendell Remote Control** (simulated ACP session). ";

  if (wantsWrite) {
    return (
      intro +
      `You asked me to work on: “${userText.slice(0, 200)}”.\n\n` +
      "Here's what I did via ACP:\n" +
      "1. Created a plan and streamed thoughts\n" +
      "2. Requested permission for a **read** tool call\n" +
      "3. Requested permission for an **edit** tool call\n" +
      "4. Streamed this final answer\n\n" +
      "In a real VPS/local setup, the Grok Build adapter talks to the `grok` CLI over stdio using the same JSON-RPC methods (`initialize` → `session/new` → `session/prompt`). " +
      "Approve or reject tool calls from your phone to keep full control of the agent."
    );
  }

  return (
    intro +
    `Regarding: “${userText.slice(0, 240)}”.\n\n` +
    "Sendell Remote Control is a multi-provider hub. This session uses the **Agent Client Protocol**:\n" +
    "- `session/update` streams thoughts, messages, and tool calls\n" +
    "- `session/request_permission` gates risky tools until you approve\n" +
    "- Multiple sessions can run concurrently with different providers\n\n" +
    "Try asking me to **implement** or **fix** something to see edit permissions. " +
    "Or open another session from the sidebar to control several agents at once."
  );
}
