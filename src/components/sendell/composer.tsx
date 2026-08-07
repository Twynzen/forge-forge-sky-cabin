import { useEffect, useRef, useState } from "react";
import { Loader2, SendHorizontal, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";

const SUGGESTIONS = [
  "Explain what this linked console is doing",
  "Implement a small change and ask for approval",
  "Summarize the project structure",
];

export function Composer({
  disabled,
  sending,
  onSend,
  onCancel,
  placeholder,
}: {
  disabled?: boolean;
  sending?: boolean;
  onSend: (text: string) => void;
  onCancel?: () => void;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const submit = () => {
    const t = text.trim();
    if (!t || disabled || sending) return;
    onSend(t);
    setText("");
  };

  return (
    <div className="safe-pb border-t border-border bg-bg/90 backdrop-blur-md">
      {!text && !sending && !disabled && (
        <div className="flex gap-2 overflow-x-auto px-3 pt-2.5 scrollbar-none sm:px-4">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setText(s)}
              className="shrink-0 rounded-full border border-border bg-bg-subtle px-3 py-1.5 text-xs text-fg-muted transition hover:border-border-strong hover:text-fg"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2 p-3 sm:px-4">
        <Textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder ?? "Message linked console…"}
          disabled={disabled}
          rows={1}
          className={cn(
            "max-h-40 min-h-11 flex-1 bg-bg-elevated",
            disabled && "opacity-60",
          )}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {sending ? (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="shrink-0"
            onClick={onCancel}
            aria-label="Stop"
          >
            <Square className="size-4 fill-current" />
          </Button>
        ) : (
          <Button
            type="button"
            size="icon"
            className="shrink-0"
            disabled={disabled || !text.trim()}
            onClick={submit}
            aria-label="Send"
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <SendHorizontal className="size-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
