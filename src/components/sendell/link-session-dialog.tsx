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
type CopyKind = "rc" | "install" | null;

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function hubUrl() {
  if (typeof window === "undefined") return "http://127.0.0.1:8080";
  return window.location.origin;
}

/** Only the live room code — never a hardcoded sample */
function liveCode(room: SessionSnapshot | null): string {
  return (room?.pairingCode ?? "").replace(/-/g, "");
}

function buildShortRc(room: SessionSnapshot | null) {
  const code = liveCode(room);
  if (!code) return "";
  return `rc ${code}`;
}

/**
 * One-time install — generic paths for ANY machine.
 * No personal folders. User runs from their clone of Sendell; --project = current project.
 */
function buildInstallOnce(hub: string) {
  return `# One-time setup (any PC) — run in a terminal, NOT inside Grok chat
# 1) Open a shell in YOUR Sendell repo clone (wherever you put it)
cd path/to/your/sendell-remote-control

# 2) Install skill + save hub (uses the project folder you care about)
#    Windows PowerShell:
node .\\scripts\\install-remote-sendell.mjs --hub ${hub} --project (Get-Location)

#    macOS / Linux (from the project you want to control, e.g. your app repo):
#    node /path/to/sendell/scripts/install-remote-sendell.mjs --hub ${hub} --project "$PWD"

# After this, every Grok session only needs:
#   rc THE_CODE_FROM_THE_PHONE
# (the code is new each time you Link console — never reuse an old sample code)
`;
}

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
  const [copied, setCopied] = useState<CopyKind>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setMode("choose");
    setRoom(null);
    setCode("");
    setError(null);
    setCopied(null);
    setCopyFailed(false);
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

  const doCopy = async (kind: Exclude<CopyKind, null>, text: string) => {
    if (!text.trim()) return;
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(kind);
      setCopyFailed(false);
      setTimeout(() => setCopied(null), 2500);
    } else {
      setCopyFailed(true);
      setCopied(null);
      setTimeout(() => setCopyFailed(false), 3000);
    }
  };

  const rcLine = buildShortRc(room);
  const installText = buildInstallOnce(hubUrl());

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="size-4 text-primary" />
            Link a console
          </DialogTitle>
          <DialogDescription>
            Each link creates a <strong className="text-fg">new</strong> code. In
            Grok type only <code className="text-primary">rc CODIGO</code> for{" "}
            <em>this</em> room.
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
                  Copy <code className="text-primary">rc …</code> for this session
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
                <p className="text-xs text-fg-muted">UI only</p>
              </div>
            </button>
          </div>
        )}

        {mode === "phone_room" && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-medium text-fg-muted">Provider</p>
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
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setMode("choose")}>
                Back
              </Button>
              <Button className="flex-1" disabled={creating} onClick={() => void createRoom()}>
                {creating ? "Creating…" : "Create room & show code"}
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
            {/* THIS session only */}
            <div className="rounded-2xl border border-primary/25 bg-primary/5 px-4 py-5 text-center">
              <p className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
                This room only — paste in Grok
              </p>
              <p className="mt-2 font-mono text-2xl font-semibold tracking-wide text-primary">
                {rcLine}
              </p>
              <p className="mt-1 text-[11px] text-fg-subtle break-all">
                hub {hubUrl()}
              </p>
              <Button
                className="mt-3 w-full sm:w-auto"
                size="sm"
                onClick={() => void doCopy("rc", rcLine)}
              >
                {copied === "rc" ? (
                  <Check className="size-3.5" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {copied === "rc" ? "Copied!" : "Copy rc + code for this room"}
              </Button>
              {copyFailed && (
                <p className="mt-2 text-[11px] text-warning">
                  Clipboard blocked — type manually:{" "}
                  <span className="font-mono text-primary">{rcLine}</span>
                </p>
              )}
            </div>

            {/* One-time install — separate action, generic paths */}
            <div className="rounded-xl border border-border bg-bg-subtle p-3 text-xs text-fg-muted space-y-2">
              <p className="font-medium text-fg">First time on this PC only</p>
              <p>
                Install once so Grok understands <code className="text-primary">rc</code>.
                Paths are generic — use <em>your</em> Sendell clone and project folder.
              </p>
              <pre className="overflow-x-auto rounded-lg border border-border bg-bg p-2 font-mono text-[10px] text-fg-muted whitespace-pre-wrap">
                {installText}
              </pre>
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={() => void doCopy("install", installText)}
              >
                {copied === "install" ? (
                  <Check className="size-3.5" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {copied === "install"
                  ? "Install instructions copied!"
                  : "Copy one-time install commands"}
              </Button>
              <p className="text-fg-subtle">
                This button does <strong className="text-fg">not</strong> copy a
                pairing code. Linking always uses the green{" "}
                <code className="text-primary">rc …</code> above.
              </p>
            </div>

            <Button className="w-full" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
