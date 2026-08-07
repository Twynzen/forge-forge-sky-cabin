/**
 * POST /api/bridge/pair
 * Console bridge claims a pairing code and receives a session token.
 */
import { createFileRoute } from "@tanstack/react-router";
import type { BridgePairInput, ProviderId } from "@/lib/hub/types";

export const Route = createFileRoute("/api/bridge/pair")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as BridgePairInput;
          if (!body?.code) {
            return Response.json({ error: "code required" }, { status: 400 });
          }
          const { getHub } = await import("@/lib/hub/hub");
          const result = getHub().pairBridge({
            code: String(body.code),
            providerId: (body.providerId || "grok-build") as ProviderId,
            hostname: body.hostname || "unknown-host",
            cwd: body.cwd || process.cwd(),
            agentName: body.agentName,
            model: body.model,
            demo: body.demo === true,
          });
          return Response.json(result);
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "pair failed" },
            { status: 400 },
          );
        }
      },
    },
  },
});
