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

/** Bump when pairing UX changes — user can verify they are not on cache */
export const PAIRING_UI_VERSION = "pairing-ui-v4";

type Mode = "choose" | "phone_room" | "enter_code" | "room_ready";
type CopyKind = "rc" | "installAgent" | "installShell" | null;

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

function liveCode(room: SessionSnapshot | null): string {
  return (room?.pairingCode ?? "").replace(/-/g, "");
}

function buildShortRc(room: SessionSnapshot | null) {
  const code = liveCode(room);
  if (!code) return "";
  return `rc ${code}`;
}

/** Agent installs skill once — NO personal paths, NO pairing code */
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
  /** Close waiting room if user dismisses without a linked console */
  onAbandonRoom?: (sessionId: string) => void;
  creating?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("choose");
  const [providerId, setProviderId] = useState<ProviderId>("grok-build");
  const [code, setCode] = useState("");
  const [room, setRoom] = useState<SessionSnapshot | null>(null);
  const [copied, setCopied] = useState<CopyKind>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCopiedPreview, setLastCopiedPreview] = useState<string>("");

  const reset = () => {
    setMode("choose");
    setRoom(null);
    setCode("");
    setError(null);
    setCopied(null);
    setCopyFailed(false);
    setLastCopiedPreview("");
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      // User closed dialog without link → drop waiting room so no ghost session
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

  const doCopy = async (kind: Exclude<CopyKind, null>, text: string) => {
    if (!text.trim()) return;
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(kind);
      setCopyFailed(false);
      setLastCopiedPreview(text.slice(0, 80).replace(/\n/g, " "));
      setTimeout(() => setCopied(null), 3000);
    } else {
      setCopyFailed(true);
      setCopied(null);
      setTimeout(() => setCopyFailed(false), 3000);
    }
  };

  const hub = hubUrl();
  const rcLine = buildShortRc(room);
  const installAgent = buildInstallAgentPrompt(hub);
  const installShell = buildInstallShell(hub);

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
                  Terminal runs <code className="text-primary">rc CODIGO</code>
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
                After install — in Grok type only
              </p>
              <p className="mt-2 font-mono text-2xl font-semibold tracking-wide text-primary">
                {rcLine}
              </p>
              <p className="mt-1 text-[11px] text-fg-subtle break-all">hub {hub}</p>
              <p className="mt-1 text-[10px] text-fg-subtle">
                Waiting for terminal… this is not a linked session yet
              </p>
              <Button
                className="mt-3 w-full"
                size="sm"
                onClick={() => void doCopy("rc", rcLine)}
              >
                {copied === "rc" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied === "rc" ? "Copied rc!" : "1. Copy rc + code"}
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-bg-subtle p-3 text-xs text-fg-muted space-y-2">
              <p className="font-medium text-fg">First time? Install skill (once)</p>
              <Button
                size="sm"
                className="w-full"
                onClick={() => void doCopy("installAgent", installAgent)}
              >
                {copied === "installAgent" ? (
                  <Check className="size-3.5" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {copied === "installAgent"
                  ? "Copied agent install prompt"
                  : "2. Copy INSTALL prompt for Grok"}
              </Button>
              <p className="text-[10px] text-fg-subtle">
                Must start with{" "}
                <code className="text-primary">[{PAIRING_UI_VERSION}]</code> — if not,
                you are on an old cached app.
              </p>
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={() => void doCopy("installShell", installShell)}
              >
                {copied === "installShell" ? (
                  <Check className="size-3.5" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {copied === "installShell"
                  ? "Copied shell commands"
                  : "Or copy shell install (manual)"}
              </Button>
            </div>

            {(copied || copyFailed) && (
              <div className="rounded-lg border border-border bg-bg p-2 text-[10px] font-mono text-fg-muted break-all">
                {copyFailed
                  ? "Clipboard blocked — long-press the text in the dialog."
                  : `Clipboard preview: ${lastCopiedPreview}…`}
              </div>
            )}

            <Button className="w-full" variant="secondary" onClick={() => handleOpenChange(false)}>
              Close (cancel room if not linked)
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
