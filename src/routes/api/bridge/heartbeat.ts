/**
 * POST /api/bridge/heartbeat
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/bridge/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { token?: string };
          if (!body?.token) {
            return Response.json({ error: "token required" }, { status: 400 });
          }
          const { getHub } = await import("@/lib/hub/hub");
          return Response.json(getHub().bridgeHeartbeat(body.token));
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "heartbeat failed" },
            { status: 401 },
          );
        }
      },
    },
  },
});
