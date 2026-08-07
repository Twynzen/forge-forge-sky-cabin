/**
 * Demo console agent — pretends a real `grok` terminal is linked.
 * Used only when demo:true. Real path uses the bridge CLI + live ACP.
 */

import type { BridgeEvent, ChatMessage, PlanStep, ToolCall } from "./types";

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("aborted", "AbortError"));
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

export async function runDemoConsoleAgent(opts: {
  text: string;
  signal?: AbortSignal;
  emit: (ev: BridgeEvent) => void;
  waitPermission: (
    toolCallId: string,
  ) => Promise<"allow" | "allow_always" | "reject">;
}): Promise<void> {
  const { text, signal, emit, waitPermission } = opts;

  try {
    emit({ type: "status", status: "thinking" });

    const steps: PlanStep[] = [
      { id: "p1", title: "Understand request from phone", status: "in_progress" },
      { id: "p2", title: "Use tools in the linked console", status: "pending" },
      { id: "p3", title: "Stream answer back to operator", status: "pending" },
    ];
    emit({ type: "plan", steps });

    const thoughtId = uid("msg");
    const thought: ChatMessage = {
      id: thoughtId,
      role: "thought",
      content: [{ type: "text", text: "" }],
      createdAt: Date.now(),
      streaming: true,
    };
    emit({ type: "message", message: thought });

    const thoughtText = `Linked console received remote prompt: “${text.slice(0, 100)}${text.length > 100 ? "…" : ""}”. Running as the already-authenticated Grok session on this machine — no API key in the phone app.`;
    for (const w of thoughtText.split(/(\s+)/)) {
      if (signal?.aborted) throw new DOMException("aborted", "AbortError");
      emit({ type: "chunk", messageId: thoughtId, chunk: w, role: "thought" });
      await sleep(10, signal);
    }
    emit({
      type: "message_update",
      message: {
        ...thought,
        content: [{ type: "text", text: thoughtText }],
        streaming: false,
      },
    });

    // Tool + permission (as if console requested approval on the phone)
    const toolId = uid("tool");
    const tool: ToolCall = {
      id: toolId,
      title: "Read workspace (console FS)",
      kind: "read",
      status: "awaiting_permission",
      input: { path: "/workspace", via: "linked-console" },
      permissionRequired: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    emit({ type: "permission", toolCall: tool });
    emit({ type: "status", status: "awaiting_permission" });

    const decision = await waitPermission(toolId);
    if (signal?.aborted) throw new DOMException("aborted", "AbortError");

    if (decision === "reject") {
      emit({
        type: "tool",
        toolCall: {
          ...tool,
          status: "rejected",
          updatedAt: Date.now(),
          output: "Rejected by phone operator",
        },
      });
      const msg: ChatMessage = {
        id: uid("msg"),
        role: "assistant",
        content: [
          {
            type: "text",
            text: "Tool was rejected on your phone. The linked console did not read the workspace. Approve the next tool call, or ask me something that doesn't need FS access.",
          },
        ],
        createdAt: Date.now(),
      };
      emit({ type: "message", message: msg });
      emit({ type: "status", status: "ready" });
      return;
    }

    emit({
      type: "tool",
      toolCall: { ...tool, status: "running", updatedAt: Date.now() },
    });
    emit({ type: "status", status: "streaming" });
    await sleep(350, signal);
    emit({
      type: "tool",
      toolCall: {
        ...tool,
        status: "completed",
        updatedAt: Date.now(),
        output:
          "src/lib/hub/\n  hub.ts\n  bridge-registry.ts\n  pairing.ts\n  demo-console.ts\nscripts/sendell-bridge.mjs",
      },
    });

    steps[0]!.status = "completed";
    steps[1]!.status = "completed";
    steps[2]!.status = "in_progress";
    emit({ type: "plan", steps: [...steps] });

    const wantsWrite = /\b(fix|edit|change|implement|add|create|refactor|write)\b/i.test(
      text,
    );

    if (wantsWrite) {
      const editId = uid("tool");
      const editTool: ToolCall = {
        id: editId,
        title: "Propose edit in linked console",
        kind: "edit",
        status: "awaiting_permission",
        input: { path: "src/lib/hub/hub.ts", via: "linked-console" },
        permissionRequired: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      emit({ type: "permission", toolCall: editTool });
      emit({ type: "status", status: "awaiting_permission" });
      const d2 = await waitPermission(editId);
      if (d2 === "reject") {
        emit({
          type: "tool",
          toolCall: {
            ...editTool,
            status: "rejected",
            updatedAt: Date.now(),
          },
        });
      } else {
        emit({
          type: "tool",
          toolCall: {
            ...editTool,
            status: "completed",
            updatedAt: Date.now(),
            output: "diff applied in console workspace (demo)",
          },
        });
      }
      emit({ type: "status", status: "streaming" });
    }

    const answerId = uid("msg");
    const answer: ChatMessage = {
      id: answerId,
      role: "assistant",
      content: [{ type: "text", text: "" }],
      createdAt: Date.now(),
      streaming: true,
    };
    emit({ type: "message", message: answer });

    const body =
      "You're talking to a **linked console session**, not an API-key agent inside this app.\n\n" +
      "Flow:\n" +
      "1. `grok` (or another agent) runs on your machine with **your subscription**\n" +
      "2. You enable remote control (`/remote` or `sendell-bridge --code …`)\n" +
      "3. This phone UI attaches to that live session over the Sendell hub\n" +
      "4. Prompts & tool approvals go to the console; streams come back here\n\n" +
      `Your message was: “${text.slice(0, 200)}”\n\n` +
      (wantsWrite
        ? "I simulated an edit tool on the console after you approved it.\n\n"
        : "") +
      "No provider API key is stored in Sendell Remote Control — auth stays in the terminal.";

    for (const w of body.split(/(\s+)/)) {
      if (signal?.aborted) throw new DOMException("aborted", "AbortError");
      emit({ type: "chunk", messageId: answerId, chunk: w, role: "assistant" });
      await sleep(12, signal);
    }
    emit({
      type: "message_update",
      message: {
        ...answer,
        content: [{ type: "text", text: body }],
        streaming: false,
      },
    });

    steps[2]!.status = "completed";
    emit({ type: "plan", steps: [...steps] });
    emit({ type: "status", status: "ready" });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      emit({ type: "status", status: "ready" });
      return;
    }
    emit({
      type: "status",
      status: "error",
      error: err instanceof Error ? err.message : "Demo console error",
    });
  }
}
