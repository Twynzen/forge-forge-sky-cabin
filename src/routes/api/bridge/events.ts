/**
 * POST /api/bridge/events
 * Console bridge pushes ACP-mirrored stream events to the hub.
 */
import { createFileRoute } from "@tanstack/react-router";
import type { BridgeEvent } from "@/lib/hub/types";

export const Route = createFileRoute("/api/bridge/events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            token?: string;
            events?: BridgeEvent[];
          };
          if (!body?.token) {
            return Response.json({ error: "token required" }, { status: 400 });
          }
          const { getHub } = await import("@/lib/hub/hub");
          getHub().applyBridgeEvents(body.token, body.events || []);
          return Response.json({ ok: true });
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "events failed" },
            { status: 401 },
          );
        }
      },
    },
  },
});
