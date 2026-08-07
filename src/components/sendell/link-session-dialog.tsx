import { useRef, useState } from "react";
import {
  Cable,
  Copy,
  Link2,
  Share2,
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
import { tryCopyText, tryShareText } from "@/lib/utils/copy";
import { cn } from "@/lib/utils/cn";

export const PAIRING_UI_VERSION = "pairing-ui-v6";

type Mode = "choose" | "phone_room" | "enter_code" | "room_ready";
type PayloadKind = "rc" | "installAgent" | "installShell";

function hubUrl() {
  if (typeof window === "undefined") return "http://127.0.0.1:8080";
  return window.location.origin;
}

function liveCode(room: SessionSnapshot | null): string {
  return (room?.pairingCode ?? "").replace(/-/g, "");
}

function buildShortRc(room: SessionSnapshot | null) {
  const code = liveCode(room);
  if (!code) return "";
  return `rc ${code}`;
}

function buildInstallAgentPrompt(hub: string) {
  return `[Sendell ${PAIRING_UI_VERSION}] Install remote-control skill ONCE (you run tools).\n\nHub URL (this phone/browser): ${hub}\n\nSteps:\n1) Find on THIS machine the folder that contains BOTH:\n   - scripts/install-remote-sendell.mjs\n   - scripts/sendell-remote.mjs\n2) Run from that folder:\n   node ./scripts/install-remote-sendell.mjs --hub ${hub} --project <CURRENT_PROJECT_DIR>\n   Windows: --project (Get-Location)\n   macOS/Linux: --project "$PWD"\n3) Confirm config:\n   Windows: %USERPROFILE%\\.sendell\\config.json\n   Print only: hub and scriptPath.\n4) Reply: sendell install ok — next use: rc CODE\n\nRules: install does NOT link. Do NOT invent codes. Pair only with phone "rc XXXXXX".`;
}

function AlwaysSelectBox({
  text,
  title,
  monoLarge,
}: {
  text: string;
  title: string;
  monoLarge?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-fg-muted">{title}</p>
        <button
          type="button"
          className="text-[10px] font-medium text-primary"
          onClick={() => {
            const el = ref.current;
            if (!el) return;
            el.focus();
            el.select();
            try {
              el.setSelectionRange(0, text.length);
            } catch {
              /* ignore */
            }
          }}
        >
          Select all
        </button>
      </div>
      <textarea
        ref={ref}
        readOnly
        value={text}
        rows={monoLarge ? 2 : Math.min(10, Math.max(3, text.split("\n").length))}
        className={cn(
          "w-full resize-y rounded-lg border border-border bg-bg p-2.5 text-fg",
          "font-mono leading-relaxed",
          monoLarge
            ? "text-center text-lg font-semibold tracking-wide text-primary"
            : "text-[11px]",
        )}
        onFocus={(e) => e.target.select()}
        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
      />
      <p className="text-[10px] text-fg-subtle">
        On phone: tap the box → long-press → Copy. (HTTP blocks auto-clipboard.)
      </p>
    </div>
  );
}

export function LinkSessionDialog({
  open,
  onOpenChange,
  providers,
  onCreateRoom,
  onJoinCode,
  onSimulateDemo,
  onAbandonRoom,
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
  onAbandonRoom?: (sessionId: string) => void;
  creating?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("choose");
  const [providerId, setProviderId] = useState<ProviderId>("grok-build");
  const [code, setCode] = useState("");
  const [room, setRoom] = useState<SessionSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [showInstall, setShowInstall] = useState(false);

  const reset = () => {
    setMode("choose");
    setRoom(null);
    setCode("");
    setError(null);
    setStatus(null);
    setShowInstall(false);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      if (room?.id && room.linkState !== "linked") {
        onAbandonRoom?.(room.id);
      }
      reset();
    }
    onOpenChange(v);
  };

  const createRoom = async () => {
    setError(null);
    const snap = await onCreateRoom({ providerId });
    if (snap) {
      setRoom(snap);
      setMode("room_ready");
    } else {
      setError("Could not create pairing room");
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

  const payloadFor = (kind: PayloadKind): string => {
    const hub = hubUrl();
    if (kind === "rc") return buildShortRc(room);
    if (kind === "installAgent") return buildInstallAgentPrompt(hub);
    return "";
  };

  const handleShare = async (kind: PayloadKind) => {
    const text = payloadFor(kind);
    if (!text) return;
    const shared = await tryShareText(
      text,
      kind === "rc" ? "Sendell rc" : "Sendell install",
    );
    setStatus(shared ? "Opened share sheet" : "Share unavailable — use the text box");
  };

  const handleCopy = async (kind: PayloadKind) => {
    const text = payloadFor(kind);
    if (!text) return;
    const result = await tryCopyText(text);
    if (result.ok && typeof window !== "undefined" && window.isSecureContext) {
      setStatus("Copied to clipboard");
    } else {
      setStatus("Use the text box → Select all → long-press Copy");
    }
  };

  const hub = hubUrl();
  const rcLine = buildShortRc(room);
  const installAgent = buildInstallAgentPrompt(hub);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="size-4 text-primary" />
            Link a console
          </DialogTitle>
          <DialogDescription>
            No session until terminal pairs.{" "}
            <span className="font-mono text-[10px] text-fg-subtle">
              {PAIRING_UI_VERSION}
            </span>
          </DialogDescription>
        </DialogHeader>

        {mode === "choose" && (
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => setMode("phone_room")}
              className="flex items-start gap-3 rounded-xl border border-border bg-bg-subtle p-3 text-left transition hover:border-primary/40"
            >
              <Smartphone className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium text-fg">Show pairing code</p>
                <p className="text-xs text-fg-muted">
                  Then type <code className="text-primary">rc CODIGO</code> in Grok
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setMode("enter_code")}
              className="flex items-start gap-3 rounded-xl border border-border bg-bg-subtle p-3 text-left transition hover:border-primary/40"
            >
              <Terminal className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium text-fg">Enter code from terminal</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => void onSimulateDemo()}
              className="flex items-start gap-3 rounded-xl border border-border bg-bg-subtle p-3 text-left transition hover:border-primary/40"
            >
              <Cable className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium text-fg">Try demo</p>
              </div>
            </button>
          </div>
        )}

        {mode === "phone_room" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {providers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={!p.available}
                  onClick={() => setProviderId(p.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition",
                    providerId === p.id
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-fg-muted",
                    !p.available && "opacity-40",
                  )}
                >
                  {p.name}
                  {!p.available ? " · soon" : ""}
                </button>
              ))}
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setMode("choose")}>
                Back
              </Button>
              <Button className="flex-1" disabled={creating} onClick={() => void createRoom()}>
                {creating ? "…" : "Show code"}
              </Button>
            </div>
          </div>
        )}

        {mode === "enter_code" && (
          <div className="space-y-4">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Code from terminal"
              className="font-mono tracking-widest"
              autoCapitalize="characters"
            />
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setMode("choose")}>
                Back
              </Button>
              <Button className="flex-1" onClick={() => void join()}>
                Link
              </Button>
            </div>
          </div>
        )}

        {mode === "room_ready" && room && liveCode(room) && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-primary/25 bg-primary/5 px-3 py-4 space-y-3">
              <p className="text-center text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
                Type this in Grok (this room only)
              </p>
              <AlwaysSelectBox text={rcLine} title="rc + code" monoLarge />
              <p className="text-center text-[10px] text-fg-subtle break-all">
                hub {hub} · not linked until terminal pairs
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" onClick={() => void handleShare("rc")}>
                  <Share2 className="size-3.5" />
                  Share
                </Button>
                <Button size="sm" variant="secondary" onClick={() => void handleCopy("rc")}>
                  <Copy className="size-3.5" />
                  Try copy
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-bg-subtle p-3 space-y-2">
              <button
                type="button"
                className="w-full text-left text-xs font-medium text-fg"
                onClick={() => setShowInstall((v) => !v)}
              >
                {showInstall ? "▾" : "▸"} First time? Install skill (once)
              </button>
              {showInstall && (
                <div className="space-y-2">
                  <AlwaysSelectBox text={installAgent} title="Paste into Grok once" />
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" onClick={() => void handleShare("installAgent")}>
                      <Share2 className="size-3.5" />
                      Share
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void handleCopy("installAgent")}
                    >
                      <Copy className="size-3.5" />
                      Try copy
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {status && (
              <p className="text-center text-[11px] text-primary">{status}</p>
            )}

            <Button
              className="w-full"
              variant="secondary"
              onClick={() => handleOpenChange(false)}
            >
              Close (cancel if not linked)
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
