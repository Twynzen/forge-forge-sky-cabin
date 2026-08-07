import { useEffect, useRef, useState } from "react";
import {
  Cable,
  Copy,
  Check,
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

/** User can verify they are not on a cached old bundle */
export const PAIRING_UI_VERSION = "pairing-ui-v5";

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
  return `[Sendell ${PAIRING_UI_VERSION}] Install remote-control skill ONCE (you run tools).

Hub URL (this phone): ${hub}

Steps:
1) Find on THIS machine the folder that contains BOTH:
   - scripts/install-remote-sendell.mjs
   - scripts/sendell-remote.mjs
   (Search the disk if needed. Do not use invented paths.)
2) Run from that folder:
   node ./scripts/install-remote-sendell.mjs --hub ${hub} --project <CURRENT_PROJECT_DIR>
   Windows PowerShell: --project (Get-Location)
   macOS/Linux: --project "$PWD"
   <CURRENT_PROJECT_DIR> = the repo where the user is working now (not necessarily Sendell).
3) Confirm config file exists:
   Windows: %USERPROFILE%\\.sendell\\config.json
   macOS/Linux: ~/.sendell/config.json
   Print only: hub and scriptPath.
4) Reply exactly: sendell install ok — next use: rc CODE

Rules:
- This install does NOT link a session.
- Do NOT invent a pairing code.
- Pairing codes only come from the phone "rc XXXXXX" after Link console.`;
}

function buildInstallShell(hub: string) {
  return `# [${PAIRING_UI_VERSION}] One-time shell install — generic paths
# cd into YOUR clone of Sendell (wherever it lives on this PC)
cd path/to/your/sendell-remote-control
node ./scripts/install-remote-sendell.mjs --hub ${hub} --project (Get-Location)
# Then in Grok: rc THE_CODE_FROM_THE_PHONE_UI (fresh each room)
`;
}

function SelectableText({
  text,
  label,
}: {
  text: string;
  label: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
    try {
      el.setSelectionRange(0, text.length);
    } catch {
      /* ignore */
    }
  }, [text]);

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-warning">
        {label} — long-press → Copy (clipboard API blocked on HTTP)
      </p>
      <textarea
        ref={ref}
        readOnly
        value={text}
        rows={Math.min(12, Math.max(4, text.split("\n").length + 1))}
        className="w-full resize-y rounded-lg border border-warning/40 bg-bg p-2.5 font-mono text-[11px] leading-relaxed text-fg"
        onFocus={(e) => e.target.select()}
        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
      />
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
  /** When auto-copy fails, show this text for manual long-press */
  const [manual, setManual] = useState<{ kind: PayloadKind; text: string } | null>(
    null,
  );

  const reset = () => {
    setMode("choose");
    setRoom(null);
    setCode("");
    setError(null);
    setStatus(null);
    setManual(null);
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
    return buildInstallShell(hub);
  };

  /** Copy; if it fails, open manual select. Never fake success. */
  const handleCopy = async (kind: PayloadKind) => {
    const text = payloadFor(kind);
    if (!text) return;
    setManual(null);
    setStatus(null);

    const result = await tryCopyText(text);
    if (result.ok) {
      setStatus(
        kind === "rc"
          ? `Copied rc (${result.method})`
          : `Copied ${kind} (${result.method})`,
      );
      // Verify best-effort: still show manual if insecure context (many phones lie)
      if (!window.isSecureContext) {
        setManual({ kind, text });
        setStatus(
          "May not stick on HTTP — text selected below, long-press Copy",
        );
      }
      return;
    }

    setManual({ kind, text });
    setStatus("Auto-copy failed — long-press the selected text below");
  };

  /** Share sheet (WhatsApp / Grok / etc.) — best path on phone */
  const handleShare = async (kind: PayloadKind) => {
    const text = payloadFor(kind);
    if (!text) return;
    setManual(null);
    const shared = await tryShareText(
      text,
      kind === "rc" ? "Sendell rc" : "Sendell install",
    );
    if (shared) {
      setStatus("Shared — pick Grok / WhatsApp / Notes");
      return;
    }
    // Fall back to manual
    await handleCopy(kind);
  };

  const hub = hubUrl();
  const rcLine = buildShortRc(room);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="size-4 text-primary" />
            Link a console
          </DialogTitle>
          <DialogDescription>
            No linked session until the terminal pairs.{" "}
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
                <p className="text-sm font-medium text-fg">Phone shows code</p>
                <p className="text-xs text-fg-muted">
                  Then <code className="text-primary">rc CODIGO</code> in Grok
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
                <p className="text-xs text-fg-muted">Agent printed a code first</p>
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
                <p className="text-xs text-fg-muted">Simulated linked console</p>
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
                {creating ? "…" : "Show pairing code"}
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
            <div className="rounded-2xl border border-primary/25 bg-primary/5 px-4 py-5 text-center">
              <p className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
                In Grok after install
              </p>
              <p className="mt-2 font-mono text-2xl font-semibold tracking-wide text-primary select-all">
                {rcLine}
              </p>
              <p className="mt-1 text-[11px] text-fg-subtle break-all">hub {hub}</p>
              <p className="mt-1 text-[10px] text-fg-subtle">
                Not linked until the terminal pairs
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button size="sm" onClick={() => void handleShare("rc")}>
                  <Share2 className="size-3.5" />
                  Share rc
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void handleCopy("rc")}
                >
                  <Copy className="size-3.5" />
                  Copy rc
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-bg-subtle p-3 text-xs text-fg-muted space-y-2">
              <p className="font-medium text-fg">First time? Install skill once</p>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" onClick={() => void handleShare("installAgent")}>
                  <Share2 className="size-3.5" />
                  Share install
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void handleCopy("installAgent")}
                >
                  <Copy className="size-3.5" />
                  Copy install
                </Button>
              </div>
              <p className="text-[10px] text-fg-subtle">
                Install text must include{" "}
                <code className="text-primary">{PAIRING_UI_VERSION}</code>
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="w-full"
                onClick={() => void handleCopy("installShell")}
              >
                Shell install (manual)
              </Button>
            </div>

            {status && (
              <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-primary">
                <Check className="size-3.5" />
                {status}
              </p>
            )}

            {manual && (
              <SelectableText
                text={manual.text}
                label={
                  manual.kind === "rc"
                    ? "rc command"
                    : manual.kind === "installAgent"
                      ? "Grok install prompt"
                      : "Shell install"
                }
              />
            )}

            <Button
              className="w-full"
              variant="secondary"
              onClick={() => handleOpenChange(false)}
            >
              Close (cancel room if not linked)
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
