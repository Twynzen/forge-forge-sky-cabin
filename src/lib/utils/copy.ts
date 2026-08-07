/**
 * Mobile-safe copy helpers.
 * navigator.clipboard often fails on http://LAN (not secure context).
 * Prefer share sheet on phones; always offer visible selectable fallback.
 */

export type CopyResult =
  | { ok: true; method: "clipboard" | "execCommand" | "share" }
  | { ok: false; method: "none" };

export async function tryCopyText(text: string): Promise<CopyResult> {
  if (!text) return { ok: false, method: "none" };

  // 1) Secure clipboard
  try {
    if (
      typeof navigator !== "undefined" &&
      window.isSecureContext &&
      navigator.clipboard?.writeText
    ) {
      await navigator.clipboard.writeText(text);
      return { ok: true, method: "clipboard" };
    }
  } catch {
    /* continue */
  }

  // 2) Legacy execCommand (sometimes works on mobile HTTP)
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.width = "2em";
    ta.style.height = "2em";
    ta.style.padding = "0";
    ta.style.border = "none";
    ta.style.outline = "none";
    ta.style.boxShadow = "none";
    ta.style.background = "transparent";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (ok) return { ok: true, method: "execCommand" };
  } catch {
    /* continue */
  }

  return { ok: false, method: "none" };
}

/** Native share sheet — most reliable on phones for handing text to WhatsApp/Grok */
export async function tryShareText(
  text: string,
  title = "Sendell",
): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title, text });
      return true;
    }
  } catch (err) {
    // user cancelled share is not failure for our purposes
    const name = err instanceof Error ? err.name : "";
    if (name === "AbortError") return true;
  }
  return false;
}
