import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, SendHorizontal, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";
import type { PromptImageInput } from "@/lib/hub/types";

const SUGGESTIONS = [
  "Explain what this linked console is doing",
  "Implement a small change and ask for approval",
  "Summarize the project structure",
];

const MAX_IMAGES = 3;
const MAX_DIM = 1600;
const JPEG_QUALITY = 0.82;

async function fileToPromptImage(file: File): Promise<PromptImageInput> {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  const scale = Math.min(1, MAX_DIM / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  return {
    base64: dataUrl,
    mimeType: "image/jpeg",
    name: file.name.replace(/\.\w+$/, "") + ".jpg",
  };
}

export function Composer({
  disabled,
  sending,
  onSend,
  onCancel,
  placeholder,
}: {
  disabled?: boolean;
  sending?: boolean;
  onSend: (text: string, images?: PromptImageInput[]) => void;
  onCancel?: () => void;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<PromptImageInput[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [packing, setPacking] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setPacking(true);
    try {
      const next = [...images];
      const nextPrev = [...previews];
      for (const file of Array.from(files)) {
        if (next.length >= MAX_IMAGES) break;
        if (!file.type.startsWith("image/")) continue;
        const img = await fileToPromptImage(file);
        next.push(img);
        nextPrev.push(img.base64!.startsWith("data:") ? img.base64! : `data:image/jpeg;base64,${img.base64}`);
      }
      setImages(next);
      setPreviews(nextPrev);
    } catch (e) {
      console.error(e);
    } finally {
      setPacking(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = () => {
    const t = text.trim();
    if ((!t && !images.length) || disabled || sending || packing) return;
    onSend(t, images.length ? images : undefined);
    setText("");
    setImages([]);
    setPreviews([]);
  };

  const canSend = (text.trim() || images.length > 0) && !disabled && !sending && !packing;

  return (
    <div className="safe-pb border-t border-border bg-bg/90 backdrop-blur-md">
      {!text && !sending && !disabled && !images.length && (
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

      {previews.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-3 pt-2.5 sm:px-4">
          {previews.map((src, i) => (
            <div key={i} className="relative shrink-0">
              <img
                src={src}
                alt=""
                className="size-16 rounded-lg border border-border object-cover"
              />
              <button
                type="button"
                className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-bg-elevated border border-border text-fg-muted"
                onClick={() => {
                  setImages((xs) => xs.filter((_, j) => j !== i));
                  setPreviews((xs) => xs.filter((_, j) => j !== i));
                }}
                aria-label="Remove image"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 p-3 sm:px-4">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="hidden"
          onChange={(e) => void addFiles(e.target.files)}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="shrink-0"
          disabled={disabled || sending || packing || images.length >= MAX_IMAGES}
          onClick={() => fileRef.current?.click()}
          aria-label="Attach image"
        >
          {packing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ImagePlus className="size-4" />
          )}
        </Button>
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
          onPaste={(e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            const files: File[] = [];
            for (const it of Array.from(items)) {
              if (it.type.startsWith("image/")) {
                const f = it.getAsFile();
                if (f) files.push(f);
              }
            }
            if (files.length) {
              e.preventDefault();
              const dt = new DataTransfer();
              files.forEach((f) => dt.items.add(f));
              void addFiles(dt.files);
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
            disabled={!canSend}
            onClick={submit}
            aria-label="Send"
          >
            <SendHorizontal className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
