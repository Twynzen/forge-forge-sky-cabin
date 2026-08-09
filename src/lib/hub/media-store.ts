/**
 * Local media store for chat images (phone ↔ console).
 * Files live on disk; messages only store mediaId + mime + name.
 */
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

const MAX_BYTES = 2.5 * 1024 * 1024; // 2.5 MB
const ALLOWED = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export type StoredMedia = {
  id: string;
  mimeType: string;
  name: string;
  size: number;
  path: string;
};

function mediaRoot(): string {
  const root =
    process.env.SENDELL_MEDIA_DIR ||
    join(process.cwd(), "data", "media");
  mkdirSync(root, { recursive: true });
  return root;
}

function extFor(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

export function saveMediaBase64(input: {
  base64: string;
  mimeType: string;
  name?: string;
}): StoredMedia {
  const mime = (input.mimeType || "image/jpeg").toLowerCase().split(";")[0].trim();
  if (!ALLOWED.has(mime)) {
    throw new Error(`Unsupported image type: ${mime}`);
  }
  let b64 = input.base64.trim();
  const dataUrl = b64.match(/^data:([^;]+);base64,(.+)$/i);
  if (dataUrl) {
    b64 = dataUrl[2];
  }
  const buf = Buffer.from(b64, "base64");
  if (!buf.length) throw new Error("Empty image");
  if (buf.length > MAX_BYTES) {
    throw new Error(`Image too large (max ${Math.round(MAX_BYTES / 1024)}KB)`);
  }
  const id = `img_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
  const ext = extFor(mime);
  const name = (input.name || `image.${ext}`).replace(/[^\w.\-]+/g, "_").slice(0, 80);
  const path = join(mediaRoot(), `${id}.${ext}`);
  writeFileSync(path, buf);
  return { id, mimeType: mime, name, size: buf.length, path };
}

export function saveMediaFile(input: {
  filePath: string;
  mimeType?: string;
  name?: string;
}): StoredMedia {
  if (!existsSync(input.filePath)) throw new Error("File not found");
  const buf = readFileSync(input.filePath);
  if (buf.length > MAX_BYTES) {
    throw new Error(`Image too large (max ${Math.round(MAX_BYTES / 1024)}KB)`);
  }
  const mime = (input.mimeType || "image/jpeg").toLowerCase();
  if (!ALLOWED.has(mime) && !mime.startsWith("image/")) {
    throw new Error(`Unsupported type: ${mime}`);
  }
  const id = `img_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
  const ext = extFor(mime);
  const name = (input.name || `image.${ext}`).replace(/[^\w.\-]+/g, "_").slice(0, 80);
  const dest = join(mediaRoot(), `${id}.${ext}`);
  writeFileSync(dest, buf);
  return {
    id,
    mimeType: mime.startsWith("image/") ? mime : "image/jpeg",
    name,
    size: buf.length,
    path: dest,
  };
}

export function getMedia(id: string): { buf: Buffer; mimeType: string; name: string } | null {
  const root = mediaRoot();
  const safe = id.replace(/[^a-zA-Z0-9_]/g, "");
  if (!safe || safe !== id) return null;
  // find file with any allowed extension
  for (const ext of ["jpg", "jpeg", "png", "webp", "gif"]) {
    const path = join(root, `${safe}.${ext}`);
    if (existsSync(path)) {
      const buf = readFileSync(path);
      const mime =
        ext === "png"
          ? "image/png"
          : ext === "webp"
            ? "image/webp"
            : ext === "gif"
              ? "image/gif"
              : "image/jpeg";
      return { buf, mimeType: mime, name: `${safe}.${ext}` };
    }
  }
  // also try exact id as filename stem with dot in name from readdir - skip
  return null;
}

export function mediaPublicPath(id: string): string {
  return `/api/hub/media/${encodeURIComponent(id)}`;
}

export function publicHubBase(): string {
  const u = (process.env.SENDELL_PUBLIC_URL || "").replace(/\/$/, "");
  return u;
}
