/**
 * Stub adapters for upcoming console providers.
 * Primary attach mode = console bridge (subscription).
 * API-key path reserved for later.
 */

import type { ProviderInfo } from "../types";
import type { AdapterSessionContext, CreateSessionInput, ProviderAdapter } from "./types";

function makeStub(info: ProviderInfo): ProviderAdapter {
  return {
    id: info.id,
    info,
    async isAvailable() {
      return false;
    },
    async createSession(_input: CreateSessionInput, _ctx: AdapterSessionContext) {
      throw new Error(
        `${info.name}: use Link console (pairing code). API-key path not enabled yet.`,
      );
    },
    async sendPrompt() {
      throw new Error("Not implemented");
    },
  };
}

export const claudeCodeAdapter = makeStub({
  id: "claude-code",
  name: "Claude Code",
  description: "Link a live Claude Code terminal (subscription)",
  available: false,
  transport: "stub",
  accent: "muted",
  icon: "bot",
});

export const geminiAdapter = makeStub({
  id: "gemini",
  name: "Gemini CLI",
  description: "Link a live Gemini CLI terminal (subscription)",
  available: false,
  transport: "stub",
  accent: "muted",
  icon: "hexagon",
});

export const gptAdapter = makeStub({
  id: "gpt",
  name: "GPT / Codex",
  description: "Link a live Codex CLI terminal (subscription)",
  available: false,
  transport: "stub",
  accent: "muted",
  icon: "cpu",
});
