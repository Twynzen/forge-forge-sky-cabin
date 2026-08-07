import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  cancelSessionFn,
  closeSessionFn,
  createLinkRoomFn,
  getSessionFn,
  joinWithCodeFn,
  listProvidersFn,
  listSessionsFn,
  resolvePermissionFn,
  startPromptFn,
} from "@/lib/api/hub-api";
import type {
  ProviderId,
  SessionSnapshot,
  ToolCall,
} from "@/lib/hub/types";
import { useAppStore } from "@/lib/store/app-store";
import { ChatPanel } from "./chat-panel";
import { LinkSessionDialog } from "./link-session-dialog";
import { SessionSidebar } from "./session-sidebar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const POLL_MS = 450;

export function AppShell() {
  const {
    providers,
    sessions,
    activeSessionId,
    snapshots,
    sidebarOpen,
    sending,
    bootstrapped,
    setProviders,
    setSessions,
    setActiveSessionId,
    setSnapshot,
    setSidebarOpen,
    setSending,
    setBootstrapped,
    removeSession,
  } = useAppStore();

  const [linkOpen, setLinkOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const refreshSessions = useCallback(async () => {
    const list = await listSessionsFn();
    setSessions(list);
    return list;
  }, [setSessions]);

  const refreshSnapshot = useCallback(
    async (id: string): Promise<SessionSnapshot | null> => {
      try {
        const snap = (await getSessionFn({
          data: { sessionId: id },
        })) as SessionSnapshot;
        setSnapshot(snap);
        return snap;
      } catch {
        return null;
      }
    },
    [setSnapshot],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [prov, list] = await Promise.all([
          listProvidersFn(),
          listSessionsFn(),
        ]);
        if (cancelled) return;
        setProviders(prov);
        setSessions(list);
        const first = list[0]?.id ?? null;
        setActiveSessionId(first);
        if (first) await refreshSnapshot(first);
        setBootstrapped(true);
      } catch (err) {
        console.error(err);
        toast.error("Failed to connect to hub");
        setBootstrapped(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    refreshSnapshot,
    setActiveSessionId,
    setBootstrapped,
    setProviders,
    setSessions,
  ]);

  useEffect(() => {
    if (!activeSessionId) return;
    const snap = snapshots[activeSessionId];
    const busy =
      sending ||
      !snap ||
      snap.status === "thinking" ||
      snap.status === "streaming" ||
      snap.status === "awaiting_permission" ||
      snap.status === "waiting_link" ||
      snap.status === "connecting";

    if (!busy && snap?.linkState !== "waiting") return;

    const t = window.setInterval(() => {
      void refreshSnapshot(activeSessionId);
      void refreshSessions();
    }, POLL_MS);

    return () => window.clearInterval(t);
  }, [
    activeSessionId,
    refreshSessions,
    refreshSnapshot,
    sending,
    snapshots,
  ]);

  const selectSession = async (id: string) => {
    setActiveSessionId(id);
    setSidebarOpen(false);
    await refreshSnapshot(id);
  };

  const handleCreateRoom = async (input: {
    providerId: ProviderId;
    title?: string;
  }): Promise<SessionSnapshot | null> => {
    setCreating(true);
    try {
      const snap = (await createLinkRoomFn({
        data: {
          providerId: input.providerId,
          title: input.title,
          demo: false,
        },
      })) as SessionSnapshot;
      setSnapshot(snap);
      await refreshSessions();
      setActiveSessionId(snap.id);
      return snap;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create room");
      return null;
    } finally {
      setCreating(false);
    }
  };

  const handleJoinCode = async (code: string): Promise<SessionSnapshot | null> => {
    setCreating(true);
    try {
      const snap = (await joinWithCodeFn({
        data: { code },
      })) as SessionSnapshot;
      setSnapshot(snap);
      await refreshSessions();
      setActiveSessionId(snap.id);
      toast.success("Listening for console");
      return snap;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Join failed");
      return null;
    } finally {
      setCreating(false);
    }
  };

  const handleSimulateDemo = async () => {
    setCreating(true);
    try {
      const snap = (await createLinkRoomFn({
        data: {
          providerId: "grok-build",
          title: "Demo console · Grok Build",
          demo: true,
        },
      })) as SessionSnapshot;
      setSnapshot(snap);
      await refreshSessions();
      setActiveSessionId(snap.id);
      toast.success("Demo console linked");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Demo failed");
    } finally {
      setCreating(false);
    }
  };

  const handleSend = async (text: string) => {
    if (!activeSessionId) return;
    setSending(true);
    try {
      await startPromptFn({
        data: { sessionId: activeSessionId, text },
      });
      await refreshSnapshot(activeSessionId);
      const pollUntilDone = async () => {
        for (let i = 0; i < 120; i++) {
          await new Promise((r) => setTimeout(r, POLL_MS));
          const snap = await refreshSnapshot(activeSessionId);
          if (
            !snap ||
            snap.status === "ready" ||
            snap.status === "error" ||
            snap.status === "closed" ||
            snap.status === "disconnected"
          ) {
            break;
          }
        }
        setSending(false);
        await refreshSessions();
      };
      void pollUntilDone();
    } catch (err) {
      setSending(false);
      toast.error(err instanceof Error ? err.message : "Send failed");
    }
  };

  const handlePermission = async (
    tool: ToolCall,
    decision: "allow" | "reject",
  ) => {
    if (!activeSessionId) return;
    try {
      await resolvePermissionFn({
        data: {
          sessionId: activeSessionId,
          toolCallId: tool.id,
          decision,
        },
      });
      await refreshSnapshot(activeSessionId);
      if (decision === "allow") {
        setSending(true);
        for (let i = 0; i < 80; i++) {
          await new Promise((r) => setTimeout(r, POLL_MS));
          const snap = await refreshSnapshot(activeSessionId);
          if (
            !snap ||
            snap.status === "ready" ||
            snap.status === "error" ||
            snap.status === "awaiting_permission"
          ) {
            break;
          }
        }
        setSending(false);
        await refreshSessions();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Permission failed");
    }
  };

  const handleCancel = async () => {
    if (!activeSessionId) return;
    await cancelSessionFn({ data: { sessionId: activeSessionId } });
    setSending(false);
    await refreshSnapshot(activeSessionId);
  };

  const handleClose = async (id: string) => {
    await closeSessionFn({ data: { sessionId: id } });
    removeSession(id);
    await refreshSessions();
  };

  const activeSnap = activeSessionId
    ? snapshots[activeSessionId] ?? null
    : null;

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-bg text-fg">
      <div className="hidden w-72 shrink-0 border-r border-border lg:block xl:w-80">
        <SessionSidebar
          sessions={sessions}
          providers={providers}
          activeId={activeSessionId}
          onSelect={(id) => void selectSession(id)}
          onNew={() => setLinkOpen(true)}
          onClose={(id) => void handleClose(id)}
        />
      </div>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-[min(100%,20rem)] p-0" showClose={false}>
          <SheetHeader className="sr-only">
            <SheetTitle>Sessions</SheetTitle>
          </SheetHeader>
          <SessionSidebar
            sessions={sessions}
            providers={providers}
            activeId={activeSessionId}
            onSelect={(id) => void selectSession(id)}
            onNew={() => {
              setSidebarOpen(false);
              setLinkOpen(true);
            }}
            onClose={(id) => void handleClose(id)}
          />
        </SheetContent>
      </Sheet>

      <main className="min-w-0 flex-1">
        {!bootstrapped ? (
          <div className="flex h-full items-center justify-center">
            <p className="shimmer text-sm font-medium">Connecting to hub…</p>
          </div>
        ) : (
          <ChatPanel
            snapshot={activeSnap}
            sending={sending}
            onMenu={() => setSidebarOpen(true)}
            onLink={() => setLinkOpen(true)}
            onSend={(t) => void handleSend(t)}
            onCancel={() => void handleCancel()}
            onAllow={(tool) => void handlePermission(tool, "allow")}
            onReject={(tool) => void handlePermission(tool, "reject")}
          />
        )}
      </main>

      <LinkSessionDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        providers={providers}
        creating={creating}
        onCreateRoom={handleCreateRoom}
        onJoinCode={handleJoinCode}
        onSimulateDemo={() => handleSimulateDemo()}
      />
    </div>
  );
}
