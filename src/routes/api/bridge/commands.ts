/**
 * GET /api/bridge/commands?token=...
 * Long-poll for phone → console commands.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/bridge/commands")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const token = url.searchParams.get("token") || "";
          if (!token) {
            return Response.json({ error: "token required" }, { status: 400 });
          }
          const timeout = Math.min(
            Number(url.searchParams.get("timeout") || 25000),
            55000,
          );
          const { getHubReady } = await import("@/lib/hub/hub");
          const h = await getHubReady();
          const commands = await h.bridgePollCommands(token, timeout);
          return Response.json({ commands });
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "poll failed" },
            { status: 401 },
          );
        }
      },
    },
  },
});
