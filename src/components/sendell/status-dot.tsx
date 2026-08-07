import { cn } from "@/lib/utils/cn";
import type { SessionStatus } from "@/lib/hub/types";

const statusColor: Record<SessionStatus, string> = {
  waiting_link: "bg-warning",
  connecting: "bg-warning",
  ready: "bg-success",
  thinking: "bg-thought",
  streaming: "bg-primary",
  awaiting_permission: "bg-warning",
  error: "bg-danger",
  disconnected: "bg-fg-subtle",
  closed: "bg-fg-subtle",
};

export function StatusDot({
  status,
  className,
  pulse,
}: {
  status: SessionStatus;
  className?: string;
  pulse?: boolean;
}) {
  const shouldPulse =
    pulse ??
    (status === "thinking" ||
      status === "streaming" ||
      status === "connecting" ||
      status === "waiting_link" ||
      status === "awaiting_permission");

  return (
    <span
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        statusColor[status],
        shouldPulse && "animate-pulse-dot",
        className,
      )}
      aria-hidden
    />
  );
}

export function statusLabel(status: SessionStatus): string {
  const map: Record<SessionStatus, string> = {
    waiting_link: "Waiting for console",
    connecting: "Connecting",
    ready: "Linked · ready",
    thinking: "Thinking",
    streaming: "Streaming",
    awaiting_permission: "Needs approval",
    error: "Error",
    disconnected: "Console offline",
    closed: "Closed",
  };
  return map[status];
}
