/**
 * REST hub API — phone client uses fetch (no createServerFn IDs).
 * Avoids TanStack "Invalid server function ID" on Windows/Vite cache skew.
 *
 * GET  /api/hub/providers
 * GET  /api/hub/sessions
 * GET  /api/hub/session?id=
 * POST /api/hub/room
 * POST /api/hub/join
 * POST /api/hub/prompt
 * POST /api/hub/permission
 * POST /api/hub/cancel
 * POST /api/hub/close
 * POST /api/hub/rename
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
          const { getHub } = await import("@/lib/hub/hub");
          const h = getHub();
          const path = params._splat || "";
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
          const { getHub } = await import("@/lib/hub/hub");
          const h = getHub();
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
          if (path === "prompt") {
            const data = body as SendPromptInput;
            // fire-and-forget style for streaming updates via poll
            void h.sendPrompt(data).catch((e) => console.error("[hub] prompt", e));
            return json({ ok: true, started: true });
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
          return err("not found", 404);
        } catch (e) {
          return err(e, 400);
        }
      },
    },
  },
});
