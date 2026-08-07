import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ProviderId, ProviderInfo } from "@/lib/hub/types";
import { cn } from "@/lib/utils/cn";

export function NewSessionDialog({
  open,
  onOpenChange,
  providers,
  onCreate,
  creating,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  providers: ProviderInfo[];
  onCreate: (input: {
    providerId: ProviderId;
    title?: string;
  }) => void;
  creating?: boolean;
}) {
  const available = providers.filter((p) => p.available);
  const [providerId, setProviderId] = useState<ProviderId>("grok-build");
  const [title, setTitle] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New session</DialogTitle>
          <DialogDescription>
            Spin up a remote agent session. Grok Build runs via ACP (demo
            simulated here; real CLI on local/VPS).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-fg-muted">
              Provider
            </label>
            <div className="grid gap-2">
              {providers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={!p.available}
                  onClick={() => setProviderId(p.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition",
                    providerId === p.id && p.available
                      ? "border-primary/40 bg-primary/10"
                      : "border-border bg-bg-subtle",
                    !p.available && "opacity-45 cursor-not-allowed",
                  )}
                >
                  <div className="flex size-9 items-center justify-center rounded-lg bg-bg-muted text-primary">
                    <Sparkles className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg">
                      {p.name}
                      {!p.available && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-fg-subtle">
                          Soon
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-fg-muted">{p.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-fg-muted">
              Title (optional)
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Refactor auth module"
            />
          </div>

          <Button
            className="w-full min-h-11"
            disabled={creating || available.length === 0}
            onClick={() =>
              onCreate({
                providerId,
                title: title.trim() || undefined,
              })
            }
          >
            {creating ? "Starting…" : "Start session"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
