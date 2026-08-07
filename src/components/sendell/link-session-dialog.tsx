import { useState } from "react";
import {
  Cable,
  Copy,
  Check,
  Link2,
  Smartphone,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ProviderId, ProviderInfo, SessionSnapshot } from "@/lib/hub/types";
import { cn } from "@/lib/utils/cn";

type Mode = "choose" | "phone_room" | "enter_code" | "room_ready";

export function LinkSessionDialog({
  open,
  onOpenChange,
  providers,
  onCreateRoom,
  onJoinCode,
  onSimulateDemo,
  creating,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  providers: ProviderInfo[];
  onCreateRoom: (input: {
    providerId: ProviderId;
    title?: string;
  }) => Promise<SessionSnapshot | null>;
  onJoinCode: (code: string) => Promise<SessionSnapshot | null>;
  onSimulateDemo: () => Promise<void>;
  creating?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("choose");
  const [providerId, setProviderId] = useState<ProviderId>("grok-build");
  const [code, setCode] = useState("");
  const [room, setRoom] = useState<SessionSnapshot | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setMode("choose");
    setRoom(null);
    setCode("");
    setError(null);
    setCopied(false);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const createRoom = async () => {
    setError(null);
    const snap = await onCreateRoom({ providerId });
    if (snap) {
      setRoom(snap);
      setMode("room_ready");
    } else {
      setError("Could not create link room");
    }
  };

  const join = async () => {
    setError(null);
    if (!code.trim()) {
      setError("Enter the code from your terminal");
      return;
    }
    const snap = await onJoinCode(code.trim());
    if (snap) {
      handleOpenChange(false);
    } else {
      setError("Could not join with that code");
    }
  };

  const copyCode = async () => {
    if (!room?.pairingCode) return;
    const raw = room.pairingCode.replace(/-/g, "");
    await navigator.clipboard.writeText(raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="size-4 text-primary" />
            Link a console session
          </DialogTitle>
          <DialogDescription>
            Connect to an agent that is <strong className="text-fg">already open</strong> on
            your machine or VPS (subscription CLI). This app never asks for an API key.
          </DialogDescription>
        </DialogHeader>

        {mode === "choose" && (
          <div className="space-y-2.5">
            <button
              type="button"
              className="flex w-full items-start gap-3 rounded-xl border border-border bg-bg-subtle p-3.5 text-left transition hover:border-primary/40 hover:bg-primary/5"
              onClick={() => setMode("phone_room")}
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Smartphone className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-fg">Phone shows code</p>
                <p className="mt-0.5 text-xs text-fg-muted leading-relaxed">
                  Create a room, then run the bridge on the machine where{" "}
                  <code className="text-primary">grok</code> is already logged in.
                </p>
              </div>
            </button>

            <button
              type="button"
              className="flex w-full items-start gap-3 rounded-xl border border-border bg-bg-subtle p-3.5 text-left transition hover:border-primary/40 hover:bg-primary/5"
              onClick={() => setMode("enter_code")}
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-bg-muted text-fg-muted">
                <Terminal className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-fg">Terminal showed a code</p>
                <p className="mt-0.5 text-xs text-fg-muted leading-relaxed">
                  You typed <code className="text-primary">/remote</code> (or the bridge printed a
                  code). Enter it here.
                </p>
              </div>
            </button>

            <button
              type="button"
              disabled={creating}
              className="flex w-full items-start gap-3 rounded-xl border border-dashed border-border bg-bg p-3.5 text-left transition hover:border-border-strong"
              onClick={() => void onSimulateDemo().then(() => handleOpenChange(false))}
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-bg-muted text-primary">
                <Cable className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-fg">Try demo console</p>
                <p className="mt-0.5 text-xs text-fg-muted leading-relaxed">
                  Instant linked session for this preview — same UX, simulated console.
                </p>
              </div>
            </button>
          </div>
        )}

        {mode === "phone_room" && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-fg-muted">
                Console provider
              </label>
              <div className="grid gap-2">
                {providers.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!p.available}
                    onClick={() => setProviderId(p.id)}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-left text-sm transition",
                      providerId === p.id && p.available
                        ? "border-primary/40 bg-primary/10"
                        : "border-border bg-bg-subtle",
                      !p.available && "opacity-45 cursor-not-allowed",
                    )}
                  >
                    <span className="font-medium text-fg">{p.name}</span>
                    {!p.available && (
                      <span className="ml-2 text-[10px] uppercase text-fg-subtle">Soon</span>
                    )}
                    <p className="mt-0.5 text-xs text-fg-muted">{p.description}</p>
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setMode("choose")}>
                Back
              </Button>
              <Button className="flex-1" disabled={creating} onClick={() => void createRoom()}>
                {creating ? "Creating…" : "Show pairing code"}
              </Button>
            </div>
          </div>
        )}

        {mode === "enter_code" && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-fg-muted">
                Code from terminal
              </label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC-123"
                className="font-mono text-center text-lg tracking-[0.3em] uppercase"
                autoComplete="off"
                autoCapitalize="characters"
              />
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setMode("choose")}>
                Back
              </Button>
              <Button className="flex-1" disabled={creating} onClick={() => void join()}>
                Link
              </Button>
            </div>
          </div>
        )}

        {mode === "room_ready" && room && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-primary/25 bg-primary/5 px-4 py-5 text-center">
              <p className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
                Pairing code
              </p>
              <p className="mt-2 font-mono text-3xl font-semibold tracking-[0.25em] text-primary">
                {room.pairingCode}
              </p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-3"
                onClick={() => void copyCode()}
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : "Copy code"}
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-bg-subtle p-3 text-xs text-fg-muted leading-relaxed space-y-2">
              <p className="font-medium text-fg">On the machine with your open agent:</p>
              <pre className="overflow-x-auto rounded-lg border border-border bg-bg p-2.5 font-mono text-[11px] text-primary">
{`node scripts/sendell-bridge.mjs \\
  --code ${room.pairingCode?.replace(/-/g, "")} \\
  --hub <this-app-url>`}
              </pre>
              <p>
                Or, when supported: type{" "}
                <code className="text-primary">/remote</code> inside{" "}
                <code className="text-primary">grok</code> and confirm this code.
              </p>
              <p className="text-fg-subtle">
                The console keeps your subscription login. This phone only relays.
              </p>
            </div>

            <Button className="w-full" onClick={() => handleOpenChange(false)}>
              Done — wait for console in session list
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
