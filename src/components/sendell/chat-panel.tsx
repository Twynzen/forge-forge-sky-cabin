import { Link2, Menu, Radio, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PromptImageInput, SessionSnapshot, ToolCall } from "@/lib/hub/types";
import { cn } from "@/lib/utils/cn";
import { Composer } from "./composer";
import { MessageList } from "./message-list";
import { ProviderBadge } from "./provider-badge";
import { StatusDot, statusLabel } from "./status-dot";
import { ToolCallCard } from "./tool-call-card";
import {
  WorkingBar,
  WorkingChip,
  isWorkingStatus,
} from "./working-indicator";

export function ChatPanel({
  snapshot,
  sending,
  relinking,
  onMenu,
  onSend,
  onCancel,
  onAllow,
  onReject,
  onLink,
  onRelink,
}: {
  snapshot: SessionSnapshot | null;
  sending?: boolean;
  relinking?: boolean;
  onMenu?: () => void;
  onSend: (text: string, images?: PromptImageInput[]) => void;
  onCancel?: () => void;
  onAllow: (tool: ToolCall) => void;
  onReject: (tool: ToolCall) => void;
  onLink?: () => void;
  /** Generate new code for THIS session (keeps history) */
  onRelink?: () => void;
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
            Link a live agent console. Chat from your phone — no API keys here.
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
  const linked = snapshot.linkState === "linked";
  const offline =
    snapshot.linkState === "disconnected" ||
    snapshot.status === "disconnected";
  const busy =
    sending ||
    snapshot.status === "thinking" ||
    snapshot.status === "streaming" ||
    snapshot.status === "awaiting_permission";
  const working = isWorkingStatus(snapshot.status, sending);

  const projectName =
    snapshot.cwd?.split(/[/\\]/).filter(Boolean).pop() ||
    snapshot.hostLabel?.split("·")[0]?.trim() ||
    snapshot.title;

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
            {linked && (
              <span
                className={cn(
                  "shrink-0 rounded-md border border-success/40 bg-success/15 px-1.5 py-0.5",
                  "font-mono text-[10px] font-semibold tracking-wide text-success",
                )}
                title="Remote control active"
              >
                /rc
              </span>
            )}
            {offline && (
              <span className="shrink-0 rounded-md border border-warning/40 bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                offline
              </span>
            )}
            <WorkingChip active={working} status={snapshot.status} sending={sending} />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 pl-4">
            <ProviderBadge providerId={snapshot.providerId} demo={snapshot.demo} />
            {projectName && (
              <span className="truncate text-[11px] text-fg-subtle">{projectName}</span>
            )}
            {!linked && !offline && (
              <span className="text-[11px] text-fg-subtle">{statusLabel(snapshot.status)}</span>
            )}
          </div>
        </div>
      </header>
      <WorkingBar active={working} status={snapshot.status} sending={sending} />

      {waiting && (
        <div className="border-b border-warning/30 bg-warning/10 px-4 py-3 text-center">
          <p className="text-xs font-medium text-warning">
            {snapshot.messages.length > 0 ? "Reconnect this session" : "Pairing code"}
          </p>
          {snapshot.pairingCode && (
            <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.2em] text-fg">
              {snapshot.pairingCode}
            </p>
          )}
          <p className="mt-1.5 text-[11px] text-fg-muted">
            In Grok type{" "}
            <code className="text-primary">
              /remote-sendell {snapshot.pairingCode || "CODIGO"}
            </code>
          </p>
          <p className="mt-1 text-[10px] text-fg-subtle">
            Same chat history is kept. Resume Grok first, then run the command.
          </p>
        </div>
      )}

      {offline && !waiting && (
        <div className="border-b border-warning/30 bg-warning/10 px-4 py-3">
          <p className="text-xs font-medium text-warning">Console offline</p>
          <p className="mt-1 text-[11px] text-fg-muted leading-relaxed">
            Grok stopped, crashed, or the cable dropped. Chat history is saved.
            Resume Grok on the PC, then reconnect to this same session.
          </p>
          {onRelink && (
            <Button
              size="sm"
              className="mt-2.5"
              disabled={relinking}
              onClick={onRelink}
            >
              <RefreshCw className={cn("size-3.5", relinking && "animate-spin")} />
              {relinking ? "Preparing…" : "Reconnect (new code)"}
            </Button>
          )}
        </div>
      )}

      {pending && (
        <div className="border-b border-warning/30 bg-warning/10 px-3 py-2.5 sm:px-4">
          <p className="mb-2 text-xs font-medium text-warning">Permission needed</p>
          <ToolCallCard
            tool={pending}
            onAllow={() => onAllow(pending)}
            onReject={() => onReject(pending)}
          />
        </div>
      )}

      <div className="min-h-0 flex-1">
        <MessageList
          messages={snapshot.messages}
          onAllow={onAllow}
          onReject={onReject}
          working={working && !pending}
          workingStatus={snapshot.status}
          sending={sending}
        />
      </div>

      <Composer
        disabled={
          waiting ||
          offline ||
          snapshot.status === "closed" ||
          snapshot.status === "disconnected"
        }
        sending={busy && !pending}
        onSend={onSend}
        onCancel={onCancel}
        placeholder={
          waiting
            ? "Waiting for console to pair…"
            : offline
              ? "Console offline — reconnect first"
              : pending
                ? "Approve or reject above…"
                : "Message or attach image…"
        }
      />
    </div>
  );
}
