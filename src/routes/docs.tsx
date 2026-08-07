import type { ReactNode } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  Cable,
  KeyRound,
  Layers,
  Link2,
  Radio,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/docs")({
  component: DocsPage,
  head: () => ({
    meta: [{ title: "How linking works · Sendell Remote Control" }],
  }),
});

function DocsPage() {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="safe-pt sticky top-0 z-10 border-b border-border bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Button asChild variant="ghost" size="icon-sm">
            <Link to="/">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <p className="text-sm font-semibold tracking-tight">How linking works</p>
            <p className="text-[11px] text-fg-subtle">Sendell Remote Control</p>
          </div>
        </div>
      </header>

      <article className="mx-auto max-w-3xl space-y-10 px-4 py-8 pb-20">
        <section className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Radio className="size-3.5" />
            Subscription sessions first
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-balance">
            Control the console you already opened
          </h1>
          <p className="text-fg-muted leading-relaxed">
            Sendell Remote Control does <strong className="text-fg">not</strong> replace your
            agent login. You open <code className="text-primary">grok</code> (or another CLI)
            with your normal subscription / OAuth, then <strong className="text-fg">link</strong>{" "}
            that live session to this phone UI.
          </p>
        </section>

        <Section
          icon={Link2}
          title="Primary model: linked console"
          body={
            <div className="space-y-3 text-fg-muted leading-relaxed">
              <ol className="list-decimal space-y-2 pl-5">
                <li>
                  On your laptop/VPS, start the agent as usual (browser OAuth / subscription
                  already done).
                </li>
                <li>
                  In the phone app: <strong className="text-fg">Link console</strong> → get a
                  pairing code (or enter a code the terminal printed after{" "}
                  <code className="text-primary">/remote</code>).
                </li>
                <li>
                  On the machine, run the bridge next to that console:
                  <pre className="mt-2 overflow-x-auto rounded-xl border border-border bg-bg-elevated p-3 font-mono text-[11px] text-primary">
{`node scripts/sendell-bridge.mjs \\
  --code ABC123 \\
  --hub https://your-sendell-url`}
                  </pre>
                </li>
                <li>
                  Chat and approve tools from the phone. The process on the machine stays the
                  source of truth.
                </li>
              </ol>
            </div>
          }
        />

        <Section
          icon={Layers}
          title="Architecture"
          body={
            <pre className="overflow-x-auto rounded-xl border border-border bg-bg-elevated p-4 font-mono text-xs text-fg-muted leading-relaxed">
{`┌─────────────┐     HTTPS      ┌──────────────┐
│ Phone PWA   │◄──────────────►│ Sendell Hub  │
│ (operator)  │   pair/chat    │  rooms+codes │
└─────────────┘                └──────▲───────┘
                                      │ bridge poll
                               ┌──────┴───────┐
                               │ sendell-bridge│
                               │ (your machine)│
                               └──────▲───────┘
                                      │ ACP / attach
                               ┌──────┴───────┐
                               │ grok / claude │
                               │ OAuth session │
                               └──────────────┘`}
            </pre>
          }
        />

        <Section
          icon={Terminal}
          title="Vision: /remote inside the agent"
          body={
            <p className="text-fg-muted leading-relaxed">
              Ideal UX: inside the TUI you type{" "}
              <code className="text-primary">/remote</code>, the agent prints a code (or QR),
              and the phone joins. Until providers ship that natively,{" "}
              <code className="text-primary">sendell-bridge</code> is the adapter that sits
              next to the open session.
            </p>
          }
        />

        <Section
          icon={KeyRound}
          title="API keys (secondary, kept for later)"
          body={
            <p className="text-fg-muted leading-relaxed">
              API-key / headless agent mode is{" "}
              <strong className="text-fg">not the default</strong>, but we keep the door open
              for automation, CI, or providers that only expose keys. Subscription OAuth
              consoles remain the product priority. ACP client code under{" "}
              <code className="text-primary">src/lib/hub/acp/</code> and optional env{" "}
              <code className="text-primary">SENDELL_GROK_ACP_*</code> on the bridge are the
              hooks for that path later.
            </p>
          }
        />

        <Section
          icon={Cable}
          title="Demo in this preview"
          body={
            <p className="text-fg-muted leading-relaxed">
              Use <strong className="text-fg">Try demo console</strong> to exercise the same
              phone UX without a real machine. It simulates a linked, already-authenticated
              console — not an API-key chat inside the browser.
            </p>
          }
        />

        <section className="rounded-2xl border border-border bg-bg-elevated p-5">
          <h2 className="font-display text-lg font-semibold tracking-tight">Roadmap</h2>
          <ul className="mt-3 space-y-2 text-sm text-fg-muted">
            <li>· Native <code className="text-primary">/remote</code> in Grok Build TUI</li>
            <li>· Claude Code / Gemini / Codex console bridges</li>
            <li>· QR pairing + deep links</li>
            <li>· Optional API-key automation mode (secondary)</li>
            <li>· SSE push, multi-user workspaces</li>
          </ul>
        </section>

        <Button asChild className="w-full sm:w-auto">
          <Link to="/">Back to control panel</Link>
        </Button>
      </article>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-bg-subtle text-primary">
          <Icon className="size-4" />
        </div>
        <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
      </div>
      {body}
    </section>
  );
}
