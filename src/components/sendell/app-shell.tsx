import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  cancelSessionFn,
  closeSessionFn,
  renameSessionFn,
  createLinkRoomFn,
  getSessionFn,
  joinWithCodeFn,
  listProvidersFn,
  listSessionsFn,
  resolvePermissionFn,
  startPromptFn,
} from "@/lib/api/hub-api";
import type {
  PromptImageInput,
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
  const [pendingRoomId, setPendingRoomId] = useState<string | null>(null);

  /** Show linked + offline consoles (not unpaired waiting rooms) */
  const visibleSessions = useMemo(
    () =>
      sessions.filter(
        (s) =>
          s.linkState === "linked" ||
          s.linkState === "disconnected" ||
          s.status === "disconnected",
      ),
    [sessions],
  );

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
        const pick =
          list.find((s) => s.linkState === "linked")?.id ??
          list[0]?.id ??
          null;
        setActiveSessionId(pick);
        if (pick) await refreshSnapshot(pick);
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
    if (!bootstrapped) return;
    const id = window.setInterval(async () => {
      try {
        const list = await refreshSessions();
        if (activeSessionId) {
          const still = list.some((s) => s.id === activeSessionId);
          if (!still) {
            setActiveSessionId(list[0]?.id ?? null);
            if (list[0]) await refreshSnapshot(list[0].id);
          } else {
            await refreshSnapshot(activeSessionId);
          }
        }
        if (pendingRoomId) {
          const snap = (await getSessionFn({
            data: { sessionId: pendingRoomId },
          })) as SessionSnapshot | null;
          if (snap?.linkState === "linked") {
            setPendingRoomId(null);
            setActiveSessionId(snap.id);
            setSnapshot(snap);
            setLinkOpen(false);
            toast.success("Console linked · /rc");
          }
        }
      } catch {
        /* ignore */
      }
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [
    activeSessionId,
    bootstrapped,
    pendingRoomId,
    refreshSessions,
    refreshSnapshot,
    setActiveSessionId,
    setSnapshot,
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
      setPendingRoomId(snap.id);
      await refreshSessions();
      return snap;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create room");
      return null;
    } finally {
      setCreating(false);
    }
  };

  const handleAbandonRoom = async (sessionId: string) => {
    try {
      await closeSessionFn({ data: { sessionId } });
    } catch {
      /* ignore */
    }
    if (pendingRoomId === sessionId) setPendingRoomId(null);
    removeSession(sessionId);
    await refreshSessions();
  };

  const handleJoinCode = async (code: string): Promise<SessionSnapshot | null> => {
    setCreating(true);
    try {
      const snap = (await joinWithCodeFn({
        data: { code },
      })) as SessionSnapshot;
      setPendingRoomId(snap.id);
      await refreshSessions();
      return snap;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Join failed");
      return null;
    } finally {
      setCreating(false);
    }
  };

  const handleSimulateDemo = async (): Promise<void> => {
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
      setLinkOpen(false);
      toast.success("Demo console linked");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Demo failed");
    } finally {
      setCreating(false);
    }
  };

  const handleSend = async (text: string, images?: PromptImageInput[]) => {
    if (!activeSessionId) return;
    if (!text.trim() && !(images && images.length)) return;
    setSending(true);
    try {
      await startPromptFn({
        data: { sessionId: activeSessionId, text, images },
      });
      await refreshSnapshot(activeSessionId);
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
    } catch (err) {
      setSending(false);
      toast.error(err instanceof Error ? err.message : "Send failed");
      await refreshSnapshot(activeSessionId);
    }
  };

  const handleCancel = async () => {
    if (!activeSessionId) return;
    await cancelSessionFn({ data: { sessionId: activeSessionId } });
    await refreshSnapshot(activeSessionId);
  };

  const handlePermission = async (
    tool: ToolCall,
    decision: "allow" | "allow_always" | "reject",
  ) => {
    if (!activeSessionId) return;
    await resolvePermissionFn({
      data: {
        sessionId: activeSessionId,
        toolCallId: tool.id,
        decision,
      },
    });
    await refreshSnapshot(activeSessionId);
  };


  const handleRename = async (id: string, title: string) => {
    try {
      const snap = (await renameSessionFn({
        data: { sessionId: id, title },
      })) as SessionSnapshot;
      setSnapshot(snap);
      await refreshSessions();
      toast.success("Renamed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rename failed");
    }
  };

  const handleClose = async (id: string) => {
    await closeSessionFn({ data: { sessionId: id } });
    removeSession(id);
    if (activeSessionId === id) {
      setActiveSessionId(null);
    }
    await refreshSessions();
  };

  const activeSnap = activeSessionId ? snapshots[activeSessionId] ?? null : null;

  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      <div className="hidden w-72 shrink-0 border-r border-border lg:block">
        <SessionSidebar
          sessions={visibleSessions}
          providers={providers}
          activeId={activeSessionId}
          onSelect={(id) => void selectSession(id)}
          onNew={() => setLinkOpen(true)}
          onClose={(id) => void handleClose(id)}
          onRename={(id, title) => void handleRename(id, title)}
        />
      </div>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-[min(100%,20rem)] p-0" showClose={false}>
          <SheetHeader className="sr-only">
            <SheetTitle>Sessions</SheetTitle>
          </SheetHeader>
          <SessionSidebar
            sessions={visibleSessions}
            providers={providers}
            activeId={activeSessionId}
            onSelect={(id) => void selectSession(id)}
            onNew={() => {
              setSidebarOpen(false);
              setLinkOpen(true);
            }}
            onClose={(id) => void handleClose(id)}
            onRename={(id, title) => void handleRename(id, title)}
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
            onSend={(t, imgs) => void handleSend(t, imgs)}
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
        onSimulateDemo={handleSimulateDemo}
        onAbandonRoom={(id) => void handleAbandonRoom(id)}
      />
    </div>
  );
}
