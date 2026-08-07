import {
  Check,
  FileEdit,
  FileSearch,
  Loader2,
  ShieldAlert,
  Terminal,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ToolCall } from "@/lib/hub/types";
import { cn } from "@/lib/utils/cn";

function kindIcon(kind: ToolCall["kind"]) {
  switch (kind) {
    case "read":
    case "search":
      return FileSearch;
    case "edit":
    case "delete":
    case "move":
      return FileEdit;
    case "execute":
      return Terminal;
    default:
      return ShieldAlert;
  }
}

export function ToolCallCard({
  tool,
  onAllow,
  onReject,
  compact,
}: {
  tool: ToolCall;
  onAllow?: () => void;
  onReject?: () => void;
  compact?: boolean;
}) {
  const Icon = kindIcon(tool.kind);
  const needsAction = tool.status === "awaiting_permission";
  const running = tool.status === "running" || tool.status === "pending";

  return (
    <div
      className={cn(
        "rounded-xl border bg-bg-subtle/80 overflow-hidden",
        needsAction
          ? "border-warning/40 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-warning)_15%,transparent)]"
          : "border-border",
        compact ? "text-xs" : "text-sm",
      )}
    >
      <div className="flex items-start gap-3 p-3">
        <div
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border",
            needsAction
              ? "border-warning/30 bg-warning/10 text-warning"
              : tool.status === "completed"
                ? "border-success/30 bg-success/10 text-success"
                : tool.status === "rejected" || tool.status === "failed"
                  ? "border-danger/30 bg-danger/10 text-danger"
                  : "border-border bg-bg-muted text-fg-muted",
          )}
        >
          {running && tool.status !== "awaiting_permission" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : tool.status === "completed" ? (
            <Check className="size-4" />
          ) : tool.status === "rejected" || tool.status === "failed" ? (
            <X className="size-4" />
          ) : (
            <Icon className="size-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-fg truncate">{tool.title}</p>
            <span className="font-mono text-[10px] uppercase tracking-wider text-fg-subtle">
              {tool.kind}
            </span>
          </div>
          {tool.input && (
            <pre className="mt-1.5 max-h-24 overflow-auto rounded-md bg-bg/60 p-2 font-mono text-[11px] text-fg-muted leading-relaxed">
              {JSON.stringify(tool.input, null, 2)}
            </pre>
          )}
          {tool.output && (
            <pre className="mt-1.5 max-h-32 overflow-auto rounded-md border border-border bg-bg p-2 font-mono text-[11px] text-fg-muted leading-relaxed">
              {tool.output}
            </pre>
          )}
        </div>
      </div>

      {needsAction && onAllow && onReject && (
        <div className="flex gap-2 border-t border-warning/20 bg-warning/5 p-2.5">
          <Button
            size="sm"
            className="flex-1 min-h-11"
            onClick={onAllow}
          >
            <Check className="size-3.5" />
            Allow
          </Button>
          <Button
            size="sm"
            variant="danger"
            className="flex-1 min-h-11"
            onClick={onReject}
          >
            <X className="size-3.5" />
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}
