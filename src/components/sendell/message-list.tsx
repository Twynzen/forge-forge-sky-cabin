import { useEffect, useRef } from "react";
import { Bot, Brain, User } from "lucide-react";
import type { ChatMessage, ContentBlock, ToolCall } from "@/lib/hub/types";
import { cn } from "@/lib/utils/cn";
import { ToolCallCard } from "./tool-call-card";

function renderMarkdownLite(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-fg">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="rounded bg-bg-muted px-1 py-0.5 font-mono text-[0.85em] text-primary"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function PlanBlock({ steps }: { steps: { id: string; title: string; status: string }[] }) {
  return (
    <div className="rounded-xl border border-border bg-bg-subtle/60 p-3">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
        Plan
      </p>
      <ol className="space-y-1.5">
        {steps.map((s, i) => (
          <li key={s.id} className="flex items-start gap-2 text-sm">
            <span
              className={cn(
                "mt-1 size-1.5 shrink-0 rounded-full",
                s.status === "completed" && "bg-success",
                s.status === "in_progress" && "bg-primary animate-pulse-dot",
                s.status === "failed" && "bg-danger",
                s.status === "pending" && "bg-fg-subtle",
              )}
            />
            <span
              className={cn(
                "text-fg-muted",
                s.status === "completed" && "text-fg-subtle line-through",
                s.status === "in_progress" && "text-fg",
              )}
            >
              <span className="mr-2 inline-block font-mono text-[10px] tabular-nums text-fg-subtle">
                {String(i + 1).padStart(2, "0")}
              </span>
              {s.title}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ContentBlocks({
  blocks,
  onAllow,
  onReject,
}: {
  blocks: ContentBlock[];
  onAllow?: (tool: ToolCall) => void;
  onReject?: (tool: ToolCall) => void;
}) {
  return (
    <div className="space-y-2.5">
      {blocks.map((b, i) => {
        if (b.type === "text") {
          return (
            <div
              key={i}
              className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-fg/95"
            >
              {renderMarkdownLite(b.text)}
            </div>
          );
        }
        if (b.type === "code") {
          return (
            <pre
              key={i}
              className="overflow-x-auto rounded-lg border border-border bg-bg p-3 font-mono text-xs text-fg-muted"
            >
              {b.code}
            </pre>
          );
        }
        if (b.type === "tool_call") {
          return (
            <ToolCallCard
              key={i}
              tool={b.toolCall}
              onAllow={
                b.toolCall.status === "awaiting_permission" && onAllow
                  ? () => onAllow(b.toolCall)
                  : undefined
              }
              onReject={
                b.toolCall.status === "awaiting_permission" && onReject
                  ? () => onReject(b.toolCall)
                  : undefined
              }
            />
          );
        }
        if (b.type === "plan") {
          return <PlanBlock key={i} steps={b.steps} />;
        }
        return null;
      })}
    </div>
  );
}

export function MessageList({
  messages,
  onAllow,
  onReject,
}: {
  messages: ChatMessage[];
  onAllow?: (tool: ToolCall) => void;
  onReject?: (tool: ToolCall) => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, messages[messages.length - 1]?.content]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl border border-border bg-bg-subtle">
          <Bot className="size-6 text-primary" />
        </div>
        <div>
          <p className="font-display text-lg font-medium tracking-tight text-fg">
            Ready to control
          </p>
          <p className="mt-1 max-w-xs text-sm text-fg-muted leading-relaxed">
            Send a prompt to your agent. Tool calls will pause for your approval
            on this device.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-3 py-4 sm:px-5">
      {messages.map((m) => {
        if (m.role === "system") {
          return (
            <div
              key={m.id}
              className="mx-auto max-w-md rounded-xl border border-border/80 bg-bg-subtle/50 px-3.5 py-2.5 text-center text-xs text-fg-muted leading-relaxed animate-fade-up"
            >
              <ContentBlocks blocks={m.content} />
            </div>
          );
        }

        if (m.role === "thought") {
          return (
            <div
              key={m.id}
              className="flex gap-2.5 animate-fade-up opacity-90"
            >
              <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg bg-thought/10 text-thought">
                <Brain className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1 rounded-xl border border-thought/15 bg-thought/5 px-3 py-2 text-sm text-thought/90 italic">
                <ContentBlocks blocks={m.content} />
                {m.streaming && (
                  <span className="ml-1 inline-block size-1.5 rounded-full bg-thought animate-pulse-dot" />
                )}
              </div>
            </div>
          );
        }

        const isUser = m.role === "user";

        return (
          <div
            key={m.id}
            className={cn(
              "flex gap-2.5 animate-fade-up",
              isUser && "flex-row-reverse",
            )}
          >
            <div
              className={cn(
                "mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg",
                isUser
                  ? "bg-primary/15 text-primary"
                  : "bg-bg-muted text-fg-muted",
              )}
            >
              {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
            </div>
            <div
              className={cn(
                "min-w-0 max-w-[min(100%,36rem)] rounded-2xl px-3.5 py-2.5",
                isUser
                  ? "rounded-tr-md bg-primary text-primary-fg"
                  : "rounded-tl-md border border-border bg-card",
              )}
            >
              <div className={cn(isUser && "[&_strong]:text-primary-fg [&_code]:bg-primary-fg/15 [&_code]:text-primary-fg")}>
                <ContentBlocks
                  blocks={m.content}
                  onAllow={onAllow}
                  onReject={onReject}
                />
              </div>
              {m.streaming && !isUser && (
                <span className="mt-1 inline-block size-1.5 rounded-full bg-primary animate-pulse-dot" />
              )}
            </div>
          </div>
        );
      })}
      <div ref={endRef} className="h-px" />
    </div>
  );
}
