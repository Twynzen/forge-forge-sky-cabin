/**
 * REST hub API — phone client uses fetch (no createServerFn IDs).
 *
 * GET  /api/hub/providers | sessions | session?id= | media/:id
 * POST /api/hub/room | join | prompt | permission | cancel | close | rename | upload
 */
import { createFileRoute } from "@tanstack/react-router";
import type {
  CreateLinkRoomInput,
  JoinWithCodeInput,
  PermissionDecisionInput,
  ProviderId,
  SendPromptInput,
} from "@/lib/hub/types";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function err(e: unknown, status = 400) {
  return json({ error: e instanceof Error ? e.message : "error" }, status);
}

export const Route = createFileRoute("/api/hub/$")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          const path = params._splat || "";

          if (path.startsWith("media/")) {
            const id = path.slice("media/".length).split("/")[0];
            const { getMedia } = await import("@/lib/hub/media-store");
            const media = getMedia(id);
            if (!media) return err("not found", 404);
            return new Response(new Uint8Array(media.buf), {
              status: 200,
              headers: {
                "content-type": media.mimeType,
                "cache-control": "public, max-age=86400",
                "content-disposition": `inline; filename="${media.name}"`,
              },
            });
          }

          const { getHubReady } = await import("@/lib/hub/hub");
          const h = await getHubReady();
          const url = new URL(request.url);

          if (path === "providers") {
            return json(h.listProviders());
          }
          if (path === "sessions") {
            return json(h.listSessions());
          }
          if (path === "session") {
            const id = url.searchParams.get("id");
            if (!id) return err("id required", 400);
            const snap = h.getSnapshot(id);
            if (!snap) return err("Session not found", 404);
            return json(snap);
          }
          return err("not found", 404);
        } catch (e) {
          return err(e, 500);
        }
      },
      POST: async ({ params, request }) => {
        try {
          const { getHubReady } = await import("@/lib/hub/hub");
          const h = await getHubReady();
          const path = params._splat || "";
          const body = await request.json().catch(() => ({}));

          if (path === "room") {
            const data = body as CreateLinkRoomInput;
            const snap = h.createLinkRoom({
              providerId: (data.providerId || "grok-build") as ProviderId,
              title: data.title,
              demo: data.demo === true,
            });
            return json(snap);
          }
          if (path === "join") {
            const data = body as JoinWithCodeInput;
            if (!data?.code) return err("code required");
            return json(h.joinWithCode(data.code));
          }
          if (path === "upload") {
            const { saveMediaBase64, mediaPublicPath } = await import(
              "@/lib/hub/media-store"
            );
            const { base64, mimeType, name } = body as {
              base64?: string;
              mimeType?: string;
              name?: string;
            };
            if (!base64) return err("base64 required");
            const stored = saveMediaBase64({
              base64,
              mimeType: mimeType || "image/jpeg",
              name,
            });
            return json({
              mediaId: stored.id,
              mimeType: stored.mimeType,
              name: stored.name,
              url: mediaPublicPath(stored.id),
              size: stored.size,
            });
          }
          if (path === "prompt") {
            const data = body as SendPromptInput;
            // await so phone sees errors (offline, etc.)
            try {
              await h.sendPrompt(data);
              return json({ ok: true, started: true });
            } catch (e) {
              return err(e, 400);
            }
          }
          if (path === "permission") {
            const data = body as PermissionDecisionInput;
            await h.resolvePermission(data);
            return json({ ok: true });
          }
          if (path === "cancel") {
            const sessionId = (body as { sessionId?: string }).sessionId;
            if (!sessionId) return err("sessionId required");
            await h.cancelSession(sessionId);
            return json({ ok: true });
          }
          if (path === "close") {
            const sessionId = (body as { sessionId?: string }).sessionId;
            if (!sessionId) return err("sessionId required");
            await h.closeSession(sessionId);
            return json({ ok: true });
          }
          if (path === "rename") {
            const { sessionId, title } = body as {
              sessionId?: string;
              title?: string;
            };
            if (!sessionId) return err("sessionId required");
            if (!title?.trim()) return err("title required");
            return json(h.renameSession(sessionId, title));
          }
          if (path === "relink") {
            const sessionId = (body as { sessionId?: string }).sessionId;
            if (!sessionId) return err("sessionId required");
            return json(h.relinkSession(sessionId));
          }
          return err("not found", 404);
        } catch (e) {
          return err(e, 400);
        }
      },
    },
  },
});
