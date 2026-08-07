/**
 * Server functions — phone ↔ hub boundary.
 * The phone never receives or stores provider API keys.
 */

import { createServerFn } from "@tanstack/react-start";
import type {
  CreateLinkRoomInput,
  JoinWithCodeInput,
  PermissionDecisionInput,
  ProviderId,
  SendPromptInput,
} from "../hub/types";

async function hub() {
  const { getHub } = await import("../hub/hub");
  return getHub();
}

export const listProvidersFn = createServerFn({ method: "GET" }).handler(
  async () => (await hub()).listProviders(),
);

export const listSessionsFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const h = await hub();
    h.ensureDemoSession();
    return h.listSessions();
  },
);

export const getSessionFn = createServerFn({ method: "GET" })
  .validator((data: { sessionId: string }) => data)
  .handler(async ({ data }) => {
    const snap = (await hub()).getSnapshot(data.sessionId);
    if (!snap) throw new Error("Session not found");
    return snap;
  });

/** Phone creates a room and shows a pairing code for the console */
export const createLinkRoomFn = createServerFn({ method: "POST" })
  .validator((data: CreateLinkRoomInput) => data)
  .handler(async ({ data }) => {
    return (await hub()).createLinkRoom({
      providerId: (data.providerId || "grok-build") as ProviderId,
      title: data.title,
      demo: data.demo === true,
    });
  });

/** Phone enters a code printed by the terminal (/remote) */
export const joinWithCodeFn = createServerFn({ method: "POST" })
  .validator((data: JoinWithCodeInput) => data)
  .handler(async ({ data }) => {
    return (await hub()).joinWithCode(data.code);
  });

export const sendPromptFn = createServerFn({ method: "POST" })
  .validator((data: SendPromptInput) => data)
  .handler(async ({ data }) => {
    await (await hub()).sendPrompt(data);
    return { ok: true as const };
  });

export const startPromptFn = createServerFn({ method: "POST" })
  .validator((data: SendPromptInput) => data)
  .handler(async ({ data }) => {
    const h = await hub();
    void h.sendPrompt(data).catch((err) => {
      console.error("[hub] prompt error", err);
    });
    return { ok: true as const, started: true as const };
  });

export const resolvePermissionFn = createServerFn({ method: "POST" })
  .validator((data: PermissionDecisionInput) => data)
  .handler(async ({ data }) => {
    await (await hub()).resolvePermission(data);
    return { ok: true as const };
  });

export const cancelSessionFn = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string }) => data)
  .handler(async ({ data }) => {
    await (await hub()).cancelSession(data.sessionId);
    return { ok: true as const };
  });

export const closeSessionFn = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string }) => data)
  .handler(async ({ data }) => {
    await (await hub()).closeSession(data.sessionId);
    return { ok: true as const };
  });
