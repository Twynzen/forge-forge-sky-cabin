import { cn } from "@/lib/utils/cn";
import type { SessionStatus } from "@/lib/hub/types";

export function isWorkingStatus(
  status: SessionStatus | undefined,
  sending?: boolean,
): boolean {
  if (sending) return true;
  return (
    status === "thinking" ||
    status === "streaming" ||
    status === "awaiting_permission" ||
    status === "connecting"
  );
}

function labelFor(status: SessionStatus | undefined, sending?: boolean): string {
  if (status === "awaiting_permission") return "Needs your approval";
  if (status === "streaming") return "Streaming response";
  if (status === "connecting") return "Connecting";
  if (sending || status === "thinking") return "Console working";
  return "Working";
}

/** Thin animated bar under the chat header */
export function WorkingBar({
  active,
  status,
  sending,
}: {
  active: boolean;
  status?: SessionStatus;
  sending?: boolean;
}) {
  if (!active) return null;
  return (
    <div className="relative h-0.5 w-full overflow-hidden bg-border/60">
      <div
        className="absolute inset-y-0 w-1/3 rounded-full bg-primary animate-working-bar"
        aria-hidden
      />
      <span className="sr-only">{labelFor(status, sending)}</span>
    </div>
  );
}

/** Header chip: Working · · · */
export function WorkingChip({
  active,
  status,
  sending,
}: {
  active: boolean;
  status?: SessionStatus;
  sending?: boolean;
}) {
  if (!active) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10",
        "px-2 py-0.5 text-[10px] font-medium text-primary",
      )}
    >
      <span className="flex gap-0.5" aria-hidden>
        <span className="size-1 rounded-full bg-primary animate-bounce-dot [animation-delay:0ms]" />
        <span className="size-1 rounded-full bg-primary animate-bounce-dot [animation-delay:150ms]" />
        <span className="size-1 rounded-full bg-primary animate-bounce-dot [animation-delay:300ms]" />
      </span>
      {labelFor(status, sending)}
    </span>
  );
}

/** In-chat bubble: assistant is typing / running */
export function TypingBubble({
  active,
  status,
  sending,
}: {
  active: boolean;
  status?: SessionStatus;
  sending?: boolean;
}) {
  if (!active) return null;
  if (status === "awaiting_permission") return null; // permission card is enough

  const streaming = status === "streaming";

  return (
    <div
      className="flex gap-2.5 animate-fade-up px-0"
      role="status"
      aria-live="polite"
      aria-label={labelFor(status, sending)}
    >
      <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg bg-bg-muted text-fg-muted">
        <span className="relative flex size-3.5 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
          <span className="relative size-2 rounded-full bg-primary" />
        </span>
      </div>
      <div className="rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex gap-1">
            <span className="size-1.5 rounded-full bg-fg-muted animate-bounce-dot [animation-delay:0ms]" />
            <span className="size-1.5 rounded-full bg-fg-muted animate-bounce-dot [animation-delay:160ms]" />
            <span className="size-1.5 rounded-full bg-fg-muted animate-bounce-dot [animation-delay:320ms]" />
          </span>
          <span className="text-xs text-fg-muted">
            {streaming ? "Writing…" : "Running on console…"}
          </span>
        </div>
      </div>
    </div>
  );
}
