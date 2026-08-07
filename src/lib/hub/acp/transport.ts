/**
 * ACP transport abstractions.
 * - StdioTransport: real agent subprocess (local/VPS)
 * - MemoryTransport: in-process simulated agent (demo)
 */

import { EventEmitter } from "node:events";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { spawn } from "node:child_process";
import type { JsonRpcMessage } from "./types";
import { parseMessage, serializeMessage } from "./jsonrpc";

export interface AcpTransport {
  readonly kind: "stdio" | "memory";
  send(message: JsonRpcMessage): void;
  onMessage(handler: (msg: JsonRpcMessage) => void): () => void;
  onClose(handler: (code: number | null) => void): () => void;
  onError(handler: (err: Error) => void): () => void;
  close(): void;
  isAlive(): boolean;
}

/** Line-buffered JSON-RPC over child process stdio */
export class StdioTransport implements AcpTransport {
  readonly kind = "stdio" as const;
  private proc: ChildProcessWithoutNullStreams;
  private buffer = "";
  private closed = false;
  private emitter = new EventEmitter();

  constructor(command: string, args: string[], options?: { cwd?: string; env?: NodeJS.ProcessEnv }) {
    this.proc = spawn(command, args, {
      cwd: options?.cwd,
      env: { ...process.env, ...options?.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.proc.stdout.setEncoding("utf8");
    this.proc.stdout.on("data", (chunk: string) => this.onData(chunk));
    this.proc.stderr.setEncoding("utf8");
    this.proc.stderr.on("data", (chunk: string) => {
      this.emitter.emit("error", new Error(chunk.trim() || "agent stderr"));
    });
    this.proc.on("close", (code) => {
      this.closed = true;
      this.emitter.emit("close", code);
    });
    this.proc.on("error", (err) => {
      this.closed = true;
      this.emitter.emit("error", err);
    });
  }

  private onData(chunk: string) {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";
    for (const line of lines) {
      const msg = parseMessage(line);
      if (msg) this.emitter.emit("message", msg);
    }
  }

  send(message: JsonRpcMessage): void {
    if (this.closed || !this.proc.stdin.writable) return;
    this.proc.stdin.write(serializeMessage(message));
  }

  onMessage(handler: (msg: JsonRpcMessage) => void): () => void {
    this.emitter.on("message", handler);
    return () => this.emitter.off("message", handler);
  }

  onClose(handler: (code: number | null) => void): () => void {
    this.emitter.on("close", handler);
    return () => this.emitter.off("close", handler);
  }

  onError(handler: (err: Error) => void): () => void {
    this.emitter.on("error", handler);
    return () => this.emitter.off("error", handler);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.proc.stdin.end();
      this.proc.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }

  isAlive(): boolean {
    return !this.closed && this.proc.exitCode === null;
  }
}

/**
 * In-process transport for simulated ACP agents.
 * The agent side registers as `agentHandler`.
 */
export class MemoryTransport implements AcpTransport {
  readonly kind = "memory" as const;
  private closed = false;
  private clientHandlers = new Set<(msg: JsonRpcMessage) => void>();
  private agentHandlers = new Set<(msg: JsonRpcMessage) => void>();
  private closeHandlers = new Set<(code: number | null) => void>();
  private errorHandlers = new Set<(err: Error) => void>();

  /** Client → Agent */
  send(message: JsonRpcMessage): void {
    if (this.closed) return;
    queueMicrotask(() => {
      for (const h of this.agentHandlers) h(message);
    });
  }

  /** Agent → Client */
  agentSend(message: JsonRpcMessage): void {
    if (this.closed) return;
    queueMicrotask(() => {
      for (const h of this.clientHandlers) h(message);
    });
  }

  onMessage(handler: (msg: JsonRpcMessage) => void): () => void {
    this.clientHandlers.add(handler);
    return () => this.clientHandlers.delete(handler);
  }

  /** Agent listens for client messages */
  onAgentMessage(handler: (msg: JsonRpcMessage) => void): () => void {
    this.agentHandlers.add(handler);
    return () => this.agentHandlers.delete(handler);
  }

  onClose(handler: (code: number | null) => void): () => void {
    this.closeHandlers.add(handler);
    return () => this.closeHandlers.delete(handler);
  }

  onError(handler: (err: Error) => void): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const h of this.closeHandlers) h(0);
  }

  isAlive(): boolean {
    return !this.closed;
  }
}
