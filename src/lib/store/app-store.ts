/**
 * Client-side app store (zustand).
 */

import { create } from "zustand";
import type {
  ChatMessage,
  PlanStep,
  ProviderInfo,
  SessionMeta,
  SessionSnapshot,
  ToolCall,
} from "../hub/types";

function metaFromSnap(snap: SessionSnapshot): SessionMeta {
  return {
    id: snap.id,
    title: snap.title,
    providerId: snap.providerId,
    status: snap.status,
    hostLabel: snap.hostLabel,
    cwd: snap.cwd,
    model: snap.model,
    createdAt: snap.createdAt,
    updatedAt: snap.updatedAt,
    lastError: snap.lastError,
    remoteSessionId: snap.remoteSessionId,
    demo: snap.demo,
    pairingCode: snap.pairingCode,
    linkState: snap.linkState,
    linkSource: snap.linkSource,
  };
}

interface AppState {
  providers: ProviderInfo[];
  sessions: SessionMeta[];
  activeSessionId: string | null;
  snapshots: Record<string, SessionSnapshot>;
  sidebarOpen: boolean;
  sending: boolean;
  bootstrapped: boolean;

  setProviders: (p: ProviderInfo[]) => void;
  setSessions: (s: SessionMeta[]) => void;
  setActiveSessionId: (id: string | null) => void;
  setSnapshot: (snap: SessionSnapshot) => void;
  patchSession: (id: string, patch: Partial<SessionMeta>) => void;
  appendMessage: (sessionId: string, message: ChatMessage) => void;
  updateMessage: (sessionId: string, message: ChatMessage) => void;
  applyChunk: (sessionId: string, messageId: string, chunk: string) => void;
  setPlan: (sessionId: string, steps: PlanStep[]) => void;
  setPendingPermission: (sessionId: string, tool: ToolCall | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setSending: (v: boolean) => void;
  setBootstrapped: (v: boolean) => void;
  removeSession: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  providers: [],
  sessions: [],
  activeSessionId: null,
  snapshots: {},
  sidebarOpen: false,
  sending: false,
  bootstrapped: false,

  setProviders: (providers) => set({ providers }),
  setSessions: (sessions) => set({ sessions }),
  setActiveSessionId: (activeSessionId) => set({ activeSessionId }),
  setSnapshot: (snap) =>
    set((state) => {
      const meta = metaFromSnap(snap);
      const sessions = state.sessions.some((s) => s.id === snap.id)
        ? state.sessions.map((s) => (s.id === snap.id ? meta : s))
        : [meta, ...state.sessions];
      return {
        snapshots: { ...state.snapshots, [snap.id]: snap },
        sessions,
      };
    }),
  patchSession: (id, patch) =>
    set((state) => {
      const sessions = state.sessions.map((s) =>
        s.id === id ? { ...s, ...patch } : s,
      );
      const prev = state.snapshots[id];
      const snapshots = prev
        ? { ...state.snapshots, [id]: { ...prev, ...patch } }
        : state.snapshots;
      return { sessions, snapshots };
    }),
  appendMessage: (sessionId, message) =>
    set((state) => {
      const snap = state.snapshots[sessionId];
      if (!snap) return state;
      if (snap.messages.some((m) => m.id === message.id)) return state;
      return {
        snapshots: {
          ...state.snapshots,
          [sessionId]: { ...snap, messages: [...snap.messages, message] },
        },
      };
    }),
  updateMessage: (sessionId, message) =>
    set((state) => {
      const snap = state.snapshots[sessionId];
      if (!snap) return state;
      return {
        snapshots: {
          ...state.snapshots,
          [sessionId]: {
            ...snap,
            messages: snap.messages.map((m) =>
              m.id === message.id ? message : m,
            ),
          },
        },
      };
    }),
  applyChunk: (sessionId, messageId, chunk) =>
    set((state) => {
      const snap = state.snapshots[sessionId];
      if (!snap) return state;
      return {
        snapshots: {
          ...state.snapshots,
          [sessionId]: {
            ...snap,
            messages: snap.messages.map((m) => {
              if (m.id !== messageId) return m;
              const content = m.content.map((c) =>
                c.type === "text" ? { ...c, text: c.text + chunk } : c,
              );
              const hasText = content.some((c) => c.type === "text");
              return {
                ...m,
                streaming: true,
                content: hasText
                  ? content
                  : [...content, { type: "text" as const, text: chunk }],
              };
            }),
          },
        },
      };
    }),
  setPlan: (sessionId, steps) =>
    set((state) => {
      const snap = state.snapshots[sessionId];
      if (!snap) return state;
      return {
        snapshots: {
          ...state.snapshots,
          [sessionId]: { ...snap, plan: steps },
        },
      };
    }),
  setPendingPermission: (sessionId, tool) =>
    set((state) => {
      const snap = state.snapshots[sessionId];
      if (!snap) return state;
      return {
        snapshots: {
          ...state.snapshots,
          [sessionId]: {
            ...snap,
            pendingPermissions: tool ? [tool] : [],
          },
        },
      };
    }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setSending: (sending) => set({ sending }),
  setBootstrapped: (bootstrapped) => set({ bootstrapped }),
  removeSession: (id) =>
    set((state) => {
      const { [id]: _removed, ...rest } = state.snapshots;
      const sessions = state.sessions.filter((s) => s.id !== id);
      const activeSessionId =
        state.activeSessionId === id
          ? (sessions[0]?.id ?? null)
          : state.activeSessionId;
      return { snapshots: rest, sessions, activeSessionId };
    }),
}));
