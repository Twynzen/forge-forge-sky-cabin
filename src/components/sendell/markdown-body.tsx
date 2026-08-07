/**
 * Lightweight markdown for chat bubbles (no extra deps).
 * Covers the patterns Grok/Claude usually emit.
 */
import { cn } from "@/lib/utils/cn";

type Seg =
  | { t: "text"; v: string }
  | { t: "strong"; v: string }
  | { t: "em"; v: string }
  | { t: "code"; v: string }
  | { t: "link"; v: string; href: string };

function inlineSegs(text: string): Seg[] {
  const segs: Seg[] = [];
  // order: code, link, bold, italic
  const re =
    /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(_[^_]+_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) segs.push({ t: "text", v: text.slice(last, m.index) });
    const raw = m[0];
    if (raw.startsWith("`")) {
      segs.push({ t: "code", v: raw.slice(1, -1) });
    } else if (raw.startsWith("[")) {
      const lm = raw.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (lm) segs.push({ t: "link", v: lm[1], href: lm[2] });
      else segs.push({ t: "text", v: raw });
    } else if (raw.startsWith("**")) {
      segs.push({ t: "strong", v: raw.slice(2, -2) });
    } else {
      segs.push({ t: "em", v: raw.slice(1, -1) });
    }
    last = m.index + raw.length;
  }
  if (last < text.length) segs.push({ t: "text", v: text.slice(last) });
  return segs;
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {inlineSegs(text).map((s, i) => {
        if (s.t === "strong")
          return (
            <strong key={i} className="font-semibold text-inherit">
              {s.v}
            </strong>
          );
        if (s.t === "em")
          return (
            <em key={i} className="italic">
              {s.v}
            </em>
          );
        if (s.t === "code")
          return (
            <code
              key={i}
              className="rounded bg-bg-muted/80 px-1 py-0.5 font-mono text-[0.85em] text-primary"
            >
              {s.v}
            </code>
          );
        if (s.t === "link")
          return (
            <a
              key={i}
              href={s.href}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 text-primary"
            >
              {s.v}
            </a>
          );
        return <span key={i}>{s.v}</span>;
      })}
    </>
  );
}

type Block =
  | { k: "h"; level: 1 | 2 | 3; text: string }
  | { k: "p"; text: string }
  | { k: "ul"; items: string[] }
  | { k: "ol"; items: string[] }
  | { k: "pre"; lang: string; code: string }
  | { k: "hr" }
  | { k: "bq"; text: string };

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // fenced code
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const lang = fence[1] || "";
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) {
        body.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1; // close fence
      blocks.push({ k: "pre", lang, code: body.join("\n") });
      continue;
    }

    if (/^---+\s*$/.test(line) || /^\*\*\*+\s*$/.test(line)) {
      blocks.push({ k: "hr" });
      i += 1;
      continue;
    }

    const h = line.match(/^(#{1,3})\s+(.+)$/);
    if (h) {
      blocks.push({
        k: "h",
        level: h[1].length as 1 | 2 | 3,
        text: h[2].trim(),
      });
      i += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const parts: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        parts.push(lines[i].replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push({ k: "bq", text: parts.join("\n") });
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
        i += 1;
      }
      blocks.push({ k: "ul", items });
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push({ k: "ol", items });
      continue;
    }

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    // paragraph: gather until blank or special
    const parts: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^#{1,3}\s/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^---+\s*$/.test(lines[i])
    ) {
      parts.push(lines[i]);
      i += 1;
    }
    blocks.push({ k: "p", text: parts.join("\n") });
  }

  return blocks;
}

const hClass: Record<1 | 2 | 3, string> = {
  1: "text-base font-semibold tracking-tight mt-1 mb-1.5",
  2: "text-sm font-semibold tracking-tight mt-2 mb-1",
  3: "text-[13px] font-semibold mt-1.5 mb-0.5",
};

export function MarkdownBody({
  text,
  className,
  tone = "default",
}: {
  text: string;
  className?: string;
  /** user bubble uses lighter code contrast */
  tone?: "default" | "onPrimary";
}) {
  const blocks = parseBlocks(text);
  const codeBg = tone === "onPrimary" ? "bg-black/15" : "bg-bg-muted/70";
  const border = tone === "onPrimary" ? "border-white/15" : "border-border";

  return (
    <div className={cn("space-y-2 text-sm leading-relaxed", className)}>
      {blocks.map((b, i) => {
        if (b.k === "h") {
          const Tag = (`h${b.level}` as "h1" | "h2" | "h3");
          return (
            <Tag key={i} className={cn(hClass[b.level], "text-inherit")}>
              <Inline text={b.text} />
            </Tag>
          );
        }
        if (b.k === "p") {
          return (
            <p key={i} className="whitespace-pre-wrap text-inherit">
              <Inline text={b.text} />
            </p>
          );
        }
        if (b.k === "ul") {
          return (
            <ul key={i} className="list-disc space-y-1 pl-4 text-inherit">
              {b.items.map((it, j) => (
                <li key={j}>
                  <Inline text={it} />
                </li>
              ))}
            </ul>
          );
        }
        if (b.k === "ol") {
          return (
            <ol key={i} className="list-decimal space-y-1 pl-4 text-inherit">
              {b.items.map((it, j) => (
                <li key={j}>
                  <Inline text={it} />
                </li>
              ))}
            </ol>
          );
        }
        if (b.k === "pre") {
          return (
            <pre
              key={i}
              className={cn(
                "overflow-x-auto rounded-lg border px-2.5 py-2 font-mono text-[11px] leading-relaxed",
                codeBg,
                border,
              )}
            >
              <code>{b.code}</code>
            </pre>
          );
        }
        if (b.k === "bq") {
          return (
            <blockquote
              key={i}
              className={cn(
                "border-l-2 pl-3 text-[13px] opacity-90",
                tone === "onPrimary" ? "border-white/40" : "border-primary/40",
              )}
            >
              <Inline text={b.text} />
            </blockquote>
          );
        }
        if (b.k === "hr") {
          return (
            <hr
              key={i}
              className={cn(
                "my-2 border-0 border-t",
                tone === "onPrimary" ? "border-white/20" : "border-border",
              )}
            />
          );
        }
        return null;
      })}
    </div>
  );
}
