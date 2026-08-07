/**
 * Provider registry.
 * Default product listing comes from hub.ts PROVIDERS (console-bridge).
 * These adapters are the secondary API-key/spawn path — kept for later.
 */

import type { ProviderId, ProviderInfo } from "../types";
import type { ProviderAdapter } from "./types";
import { grokBuildAdapter } from "./grok-build";
import { claudeCodeAdapter, geminiAdapter, gptAdapter } from "./stubs";

const adapters = new Map<ProviderId, ProviderAdapter>([
  ["grok-build", grokBuildAdapter],
  ["claude-code", claudeCodeAdapter],
  ["gemini", geminiAdapter],
  ["gpt", gptAdapter],
]);

export function getAdapter(id: ProviderId): ProviderAdapter {
  const a = adapters.get(id);
  if (!a) throw new Error(`Unknown provider: ${id}`);
  return a;
}

export function listAdapters(): ProviderAdapter[] {
  return Array.from(adapters.values());
}

export async function listProviderInfos(): Promise<ProviderInfo[]> {
  const result: ProviderInfo[] = [];
  for (const a of adapters.values()) {
    const available = await a.isAvailable();
    result.push({ ...a.info, available });
  }
  return result;
}

export function registerAdapter(adapter: ProviderAdapter): void {
  adapters.set(adapter.id, adapter);
}
