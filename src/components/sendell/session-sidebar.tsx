import { useEffect, useRef, useState } from "react";
import { BookOpen, Link2, MoreVertical, Pencil, Radio, Trash2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ProviderInfo, SessionMeta } from "@/lib/hub/types";
import { cn } from "@/lib/utils/cn";
import { ProviderBadge } from "./provider-badge";
import { StatusDot, statusLabel } from "./status-dot";

function SessionMenu({
  session,
  onClose,
  onRename,
  onDismiss,
}: {
  session: SessionMeta;
  onClose?: (id: string) => void;
  onRename?: (id: string, title: string) => void;
  onDismiss: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(session.title);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onDismiss();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onDismiss]);

  const submitRename = () => {
    const next = draft.trim();
    if (next && next !== session.title) {
      onRename?.(session.id, next);
    }
    onDismiss();
  };

  return (
    <div
      ref={ref}
      className="absolute right-1 top-8 z-30 min-w-[13rem] rounded-xl border border-border bg-bg-elevated py-1 shadow-soft"
      role="menu"
    >
      <div className="border-b border-border px-3 py-2">
        <p className="truncate text-[11px] font-medium text-fg">{session.title}</p>
        <p className="mt-0.5 text-[10px] text-fg-subtle">{statusLabel(session.status)}</p>
        {session.cwd && (
          <p
            className="mt-1 truncate font-mono text-[9px] text-fg-subtle"
            title={session.cwd}
          >
            {session.cwd}
          </p>
        )}
      </div>

      {renaming ? (
        <div className="space-y-2 px-2 py-2" onClick={(e) => e.stopPropagation()}>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename();
            }}
            maxLength={80}
            className="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-xs text-fg outline-none focus:border-primary"
            placeholder="Display name"
          />
          <div className="flex gap-1">
            <button
              type="button"
              className="flex-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-fg"
              onClick={submitRename}
            >
              Save
            </button>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-[11px] text-fg-muted hover:bg-bg-subtle"
              onClick={() => setRenaming(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {onRename && (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-fg transition hover:bg-bg-subtle"
              onClick={(e) => {
                e.stopPropagation();
                setDraft(session.title);
                setRenaming(true);
              }}
            >
              <Pencil className="size-3.5 text-fg-muted" />
              Rename
            </button>
          )}
          {onClose && (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-danger transition hover:bg-danger/10"
              onClick={(e) => {
                e.stopPropagation();
                onClose(session.id);
                onDismiss();
              }}
            >
              <Trash2 className="size-3.5" />
              Remove from app
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function SessionSidebar({
  sessions,
  providers,
  activeId,
  onSelect,
  onNew,
  onClose,
  onRename,
  className,
}: {
  sessions: SessionMeta[];
  providers: ProviderInfo[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onClose?: (id: string) => void;
  onRename?: (id: string, title: string) => void;
  className?: string;
}) {
  const [menuId, setMenuId] = useState<string | null>(null);

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
                "group relative flex w-full cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition",
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
              </div>
              <button
                type="button"
                className={cn(
                  "mt-0.5 rounded-md p-1.5 text-fg-subtle transition hover:bg-bg hover:text-fg",
                  "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
                  menuId === s.id && "opacity-100 bg-bg text-fg",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuId((id) => (id === s.id ? null : s.id));
                }}
                aria-label="Session options"
                aria-haspopup="menu"
                aria-expanded={menuId === s.id}
              >
                <MoreVertical className="size-3.5" />
              </button>
              {menuId === s.id && (
                <SessionMenu
                  session={s}
                  onClose={onClose}
                  onRename={onRename}
                  onDismiss={() => setMenuId(null)}
                />
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
