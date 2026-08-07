import { Link2, Menu, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SessionSnapshot, ToolCall } from "@/lib/hub/types";
import { Composer } from "./composer";
import { MessageList } from "./message-list";
import { ProviderBadge } from "./provider-badge";
import { StatusDot, statusLabel } from "./status-dot";
import { ToolCallCard } from "./tool-call-card";

export function ChatPanel({
  snapshot,
  sending,
  onMenu,
  onSend,
  onCancel,
  onAllow,
  onReject,
  onLink,
}: {
  snapshot: SessionSnapshot | null;
  sending?: boolean;
  onMenu?: () => void;
  onSend: (text: string) => void;
  onCancel?: () => void;
  onAllow: (tool: ToolCall) => void;
  onReject: (tool: ToolCall) => void;
  onLink?: () => void;
}) {
  if (!snapshot) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl border border-border bg-bg-elevated">
          <Radio className="size-7 text-primary" />
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-fg">
            Sendell Remote Control
          </h2>
          <p className="mt-2 max-w-sm text-sm text-fg-muted leading-relaxed">
            Link a console that is already running with your agent subscription.
            Chat from anywhere — no API keys here.
          </p>
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {onLink && (
            <Button onClick={onLink}>
              <Link2 className="size-4" />
              Link console
            </Button>
          )}
          {onMenu && (
            <Button variant="secondary" onClick={onMenu}>
              <Menu className="size-4" />
              Sessions
            </Button>
          )}
        </div>
      </div>
    );
  }

  const pending = snapshot.pendingPermissions[0];
  const waiting = snapshot.linkState === "waiting";
  const busy =
    sending ||
    snapshot.status === "thinking" ||
    snapshot.status === "streaming" ||
    snapshot.status === "awaiting_permission";

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <header className="safe-pt flex items-center gap-2 border-b border-border bg-bg-elevated/90 px-2 py-2 backdrop-blur-md sm:px-4">
        {onMenu && (
          <Button
            size="icon"
            variant="ghost"
            className="lg:hidden"
            onClick={onMenu}
            aria-label="Sessions"
          >
            <Menu className="size-5" />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <StatusDot status={snapshot.status} />
            <h1 className="truncate font-display text-sm font-semibold tracking-tight text-fg sm:text-base">
              {snapshot.title}
            </h1>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 pl-4">
            <ProviderBadge providerId={snapshot.providerId} demo={snapshot.demo} />
            <span className="text-[11px] text-fg-subtle">
              {statusLabel(snapshot.status)}
              {snapshot.hostLabel ? ` · ${snapshot.hostLabel}` : ""}
            </span>
          </div>
        </div>
      </header>

      {waiting && (
        <div className="border-b border-warning/30 bg-warning/10 px-4 py-3 text-center">
          <p className="text-xs font-medium text-warning">Waiting for console</p>
          {snapshot.pairingCode && (
            <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.2em] text-fg">
              {snapshot.pairingCode}
            </p>
          )}
          <p className="mt-1.5 text-[11px] text-fg-muted">
            Run the bridge on your agent machine with this code
          </p>
        </div>
      )}

      {pending && (
        <div className="border-b border-warning/30 bg-warning/10 px-3 py-2.5 sm:px-4">
          <p className="mb-2 text-xs font-medium text-warning">
            Console requests permission
          </p>
          <ToolCallCard
            tool={pending}
            onAllow={() => onAllow(pending)}
            onReject={() => onReject(pending)}
          />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <MessageList
          messages={snapshot.messages}
          onAllow={onAllow}
          onReject={onReject}
        />
      </div>

      <Composer
        sending={busy}
        disabled={
          waiting ||
          snapshot.linkState !== "linked" ||
          snapshot.status === "error" ||
          snapshot.status === "closed" ||
          snapshot.status === "disconnected" ||
          snapshot.status === "connecting"
        }
        onSend={onSend}
        onCancel={onCancel}
        placeholder={
          waiting
            ? "Link the console first…"
            : snapshot.status === "awaiting_permission"
              ? "Approve or reject the tool call above…"
              : "Message linked console…"
        }
      />
    </div>
  );
}
