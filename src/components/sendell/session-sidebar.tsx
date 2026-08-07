import { BookOpen, Link2, Radio, Trash2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ProviderInfo, SessionMeta } from "@/lib/hub/types";
import { cn } from "@/lib/utils/cn";
import { ProviderBadge } from "./provider-badge";
import { StatusDot, statusLabel } from "./status-dot";

export function SessionSidebar({
  sessions,
  providers,
  activeId,
  onSelect,
  onNew,
  onClose,
  className,
}: {
  sessions: SessionMeta[];
  providers: ProviderInfo[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onClose?: (id: string) => void;
  className?: string;
}) {
  return (
    <aside className={cn("flex h-full w-full flex-col bg-bg-elevated", className)}>
      <div className="safe-pt flex items-center gap-3 border-b border-border px-4 py-3.5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Radio className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold tracking-tight text-fg">
            Sendell
          </p>
          <p className="text-[11px] text-fg-subtle">Remote Control</p>
        </div>
        <Button
          size="icon-sm"
          variant="secondary"
          onClick={onNew}
          aria-label="Link console"
        >
          <Link2 className="size-4" />
        </Button>
      </div>

      <div className="px-3 pt-3">
        <p className="mb-2 px-1 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
          Console providers
        </p>
        <div className="flex flex-wrap gap-1.5">
          {providers.map((p) => (
            <span
              key={p.id}
              className={cn(
                "rounded-md border px-2 py-1 text-[10px] font-medium",
                p.available
                  ? "border-primary/25 bg-primary/10 text-primary"
                  : "border-border bg-bg-subtle text-fg-subtle",
              )}
              title={p.description}
            >
              {p.name}
              {!p.available ? " · soon" : ""}
            </span>
          ))}
        </div>
        <p className="mt-2 px-1 text-[11px] text-fg-subtle leading-relaxed">
          Link live terminals — no API keys in this app.
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between px-4">
        <p className="text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
          Linked sessions
        </p>
        <span className="font-mono text-[10px] text-fg-subtle tabular-nums">
          {sessions.length}
        </span>
      </div>

      <ScrollArea className="flex-1 px-2 py-2">
        <div className="space-y-1">
          {sessions.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-fg-subtle">
              No linked consoles yet
            </p>
          )}
          {sessions.map((s) => (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(s.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(s.id);
                }
              }}
              className={cn(
                "group flex w-full cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition",
                activeId === s.id
                  ? "bg-bg-muted ring-1 ring-border-strong"
                  : "hover:bg-bg-subtle",
              )}
            >
              <StatusDot status={s.status} className="mt-1.5" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{s.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <ProviderBadge providerId={s.providerId} demo={s.demo} />
                  <span className="text-[10px] text-fg-subtle">
                    {statusLabel(s.status)}
                  </span>
                </div>
                {s.hostLabel && (
                  <p className="mt-1 truncate font-mono text-[10px] text-fg-subtle">
                    {s.hostLabel}
                  </p>
                )}
                {s.linkState === "waiting" && s.pairingCode && (
                  <p className="mt-1 font-mono text-[11px] text-primary">
                    Code {s.pairingCode}
                  </p>
                )}
              </div>
              {onClose && (
                <button
                  type="button"
                  className="mt-0.5 rounded-md p-1.5 text-fg-subtle opacity-0 transition hover:bg-bg group-hover:opacity-100 hover:text-danger focus:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(s.id);
                  }}
                  aria-label="Close session"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="safe-pb border-t border-border p-3">
        <Link
          to="/docs"
          className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs text-fg-muted transition hover:bg-bg-subtle hover:text-fg"
        >
          <BookOpen className="size-3.5" />
          How linking works
        </Link>
      </div>
    </aside>
  );
}
