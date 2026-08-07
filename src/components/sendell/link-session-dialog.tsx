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

/** Clipboard works poorly on mobile HTTP (non-localhost); fall back to execCommand. */
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

/** Prompt the user pastes into Grok — no separate command install. */
function buildGrokPrompt(rawCode: string, hub: string) {
  const code = rawCode.replace(/-/g, "");
  return `/remote-sendell

code: ${code}
hub: ${hub}
script: C:\\\\Users\\\\Daniel\\\\Desktop\\\\Daniel\\\\sendell-remote-control\\\\forge-forge-sky-cabin\\\\scripts\\\\sendell-remote.mjs

Quiet mode (like /rc):
- Do NOT narrate waiting, pair, timeouts, or loops in chat.
- Optional one line after pair: rc on
- pair once, then wait loop:
  node "<script>" pair --code ${code} --hub ${hub} --cwd (Get-Location)
  node "<script>" wait --cwd (Get-Location) --timeout 300000
- On JSON type=prompt: treat "text" as a normal user message (same quality).
- reply --text with the answer ONLY (no "esperando…", no session ids).
- Then silent wait again until I say stop (rc off).
- No API keys. No sendell-bridge --demo.`;
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
  const [copied, setCopied] = useState<"code" | "prompt" | null>(null);
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

  const copyCode = async () => {
    if (!room?.pairingCode) return;
    const raw = room.pairingCode.replace(/-/g, "");
    const ok = await copyToClipboard(raw);
    if (ok) {
      setCopied("code");
      setCopyFailed(false);
      setTimeout(() => setCopied(null), 2500);
    } else {
      setCopyFailed(true);
      setCopied(null);
      setTimeout(() => setCopyFailed(false), 3000);
    }
  };

  const copyGrokPrompt = async () => {
    if (!room?.pairingCode) return;
    const text = buildGrokPrompt(room.pairingCode, hubUrl());
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied("prompt");
      setCopyFailed(false);
      setTimeout(() => setCopied(null), 3000);
    } else {
      setCopyFailed(true);
      setCopied(null);
      setTimeout(() => setCopyFailed(false), 3000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="size-4 text-primary" />
            Link a console
          </DialogTitle>
          <DialogDescription>
            No API key. Paste a short prompt into Grok — no extra install.
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
                  Copy a ready-made Grok prompt with the code filled in
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
                <p className="text-xs text-fg-muted">
                  If the agent printed a code first
                </p>
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
                <p className="text-xs text-fg-muted">UI only, no real machine</p>
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
                {creating ? "Creating…" : "Show pairing code"}
              </Button>
            </div>
          </div>
        )}

        {mode === "enter_code" && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-medium text-fg-muted">Pairing code</p>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                className="font-mono tracking-widest"
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
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button
                  size="sm"
                  variant={copied === "code" ? "default" : "secondary"}
                  onClick={() => void copyCode()}
                >
                  {copied === "code" ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {copied === "code" ? "Copied!" : "Copy code"}
                </Button>
                <Button
                  size="sm"
                  variant={copied === "prompt" ? "default" : "default"}
                  className={copied === "prompt" ? "" : "bg-primary"}
                  onClick={() => void copyGrokPrompt()}
                >
                  {copied === "prompt" ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {copied === "prompt" ? "Prompt copied!" : "Copy prompt for Grok"}
                </Button>
              </div>
              {copyFailed && (
                <p className="mt-2 text-[11px] text-warning">
                  Clipboard blocked — long-press the code or select the prompt below.
                </p>
              )}
              {copied === "prompt" && (
                <p className="mt-2 text-[11px] font-medium text-primary">
                  Paste into Grok on the PC (same project folder you care about).
                </p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-bg-subtle p-3 text-xs text-fg-muted leading-relaxed space-y-2">
              <p className="font-medium text-fg">How it works</p>
              <ol className="list-decimal space-y-1 pl-4">
                <li>
                  Tap <strong className="text-fg">Copy prompt for Grok</strong>
                </li>
                <li>On the PC, open Grok in your project folder</li>
                <li>Paste and send — no separate install</li>
                <li>Phone shows <span className="text-primary">/rc</span> when linked</li>
              </ol>
              <pre className="mt-2 max-h-32 overflow-auto rounded-lg border border-border bg-bg p-2.5 font-mono text-[10px] text-fg-muted whitespace-pre-wrap">
                {buildGrokPrompt(room.pairingCode ?? "", hubUrl())}
              </pre>
            </div>

            <Button className="w-full" onClick={() => handleOpenChange(false)}>
              Done — paste in Grok
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
