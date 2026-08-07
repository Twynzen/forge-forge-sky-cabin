/**
 * ACP Client — talks to an agent over a transport.
 * Handles request/response correlation, session/update notifications,
 * and session/request_permission round-trips.
 */

import type {
  InitializeParams,
  InitializeResult,
  JsonRpcMessage,
  JsonRpcRequest,
  RequestPermissionParams,
  RequestPermissionResult,
  SessionCancelParams,
  SessionNewParams,
  SessionNewResult,
  SessionPromptParams,
  SessionPromptResult,
  SessionUpdateParams,
} from "./types";
import { ACP_PROTOCOL_VERSION } from "./types";
import {
  createRequestId,
  isNotification,
  isRequest,
  isResponse,
  makeRequest,
  makeResult,
} from "./jsonrpc";
import type { AcpTransport } from "./transport";

export type PermissionHandler = (
  params: RequestPermissionParams,
) => Promise<RequestPermissionResult>;

export type SessionUpdateHandler = (params: SessionUpdateParams) => void;

export type ClientMethodHandler = (
  method: string,
  params: unknown,
  id: number | string,
) => Promise<unknown> | unknown;

export interface AcpClientOptions {
  transport: AcpTransport;
  clientName?: string;
  clientVersion?: string;
  onSessionUpdate?: SessionUpdateHandler;
  onPermissionRequest?: PermissionHandler;
  onClientMethod?: ClientMethodHandler;
  onError?: (err: Error) => void;
  onClose?: (code: number | null) => void;
}

export class AcpClient {
  private transport: AcpTransport;
  private pending = new Map<
    number | string,
    {
      resolve: (v: unknown) => void;
      reject: (e: Error) => void;
    }
  >();
  private unsubs: Array<() => void> = [];
  private initialized = false;
  private agentInfo: InitializeResult | null = null;
  private options: AcpClientOptions;

  constructor(options: AcpClientOptions) {
    this.options = options;
    this.transport = options.transport;

    this.unsubs.push(
      this.transport.onMessage((msg) => this.handleMessage(msg)),
    );
    this.unsubs.push(
      this.transport.onClose((code) => {
        this.rejectAll(new Error(`Agent closed (${code})`));
        options.onClose?.(code);
      }),
    );
    this.unsubs.push(
      this.transport.onError((err) => {
        options.onError?.(err);
      }),
    );
  }

  get isInitialized() {
    return this.initialized;
  }

  get info() {
    return this.agentInfo;
  }

  async initialize(): Promise<InitializeResult> {
    const params: InitializeParams = {
      protocolVersion: ACP_PROTOCOL_VERSION,
      clientInfo: {
        name: this.options.clientName ?? "Sendell Remote Control",
        version: this.options.clientVersion ?? "1.0.0",
      },
      capabilities: {
        fs: { readTextFile: true, writeTextFile: true },
        terminal: true,
      },
    };
    const result = (await this.request("initialize", params)) as InitializeResult;
    this.agentInfo = result;
    this.initialized = true;

    // Many agents expect a follow-up authenticated notification
    this.notify("authenticated", {});
    return result;
  }

  async newSession(params: SessionNewParams): Promise<SessionNewResult> {
    return (await this.request("session/new", params)) as SessionNewResult;
  }

  async prompt(params: SessionPromptParams): Promise<SessionPromptResult> {
    return (await this.request("session/prompt", params)) as SessionPromptResult;
  }

  cancel(params: SessionCancelParams): void {
    this.notify("session/cancel", params);
  }

  private request(method: string, params?: unknown): Promise<unknown> {
    const id = createRequestId();
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.transport.send(makeRequest(method, params, id));
    });
  }

  private notify(method: string, params?: unknown): void {
    this.transport.send({ jsonrpc: "2.0", method, params });
  }

  private async handleMessage(msg: JsonRpcMessage): Promise<void> {
    if (isResponse(msg)) {
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      this.pending.delete(msg.id);
      if (msg.error) {
        pending.reject(new Error(msg.error.message));
      } else {
        pending.resolve(msg.result);
      }
      return;
    }

    if (isNotification(msg)) {
      if (msg.method === "session/update") {
        this.options.onSessionUpdate?.(msg.params as SessionUpdateParams);
      }
      return;
    }

    if (isRequest(msg)) {
      await this.handleAgentRequest(msg);
    }
  }

  private async handleAgentRequest(msg: JsonRpcRequest): Promise<void> {
    try {
      if (msg.method === "session/request_permission") {
        const params = msg.params as RequestPermissionParams;
        const handler = this.options.onPermissionRequest;
        const result: RequestPermissionResult = handler
          ? await handler(params)
          : { outcome: { outcome: "selected", optionId: "allow-once" } };
        this.transport.send(makeResult(msg.id, result));
        return;
      }

      if (
        msg.method === "fs/read_text_file" ||
        msg.method === "fs/write_text_file" ||
        msg.method.startsWith("terminal/")
      ) {
        const handler = this.options.onClientMethod;
        if (handler) {
          const result = await handler(msg.method, msg.params, msg.id);
          this.transport.send(makeResult(msg.id, result ?? {}));
        } else {
          // Safe defaults for remote control (no real FS from hub)
          if (msg.method === "fs/read_text_file") {
            this.transport.send(
              makeResult(msg.id, {
                content: "// (remote control: filesystem not bridged)\n",
              }),
            );
          } else {
            this.transport.send(makeResult(msg.id, {}));
          }
        }
        return;
      }

      this.transport.send(
        makeResult(msg.id, { ok: true }),
      );
    } catch (err) {
      this.transport.send({
        jsonrpc: "2.0",
        id: msg.id,
        error: {
          code: -32000,
          message: err instanceof Error ? err.message : "Client handler error",
        },
      });
    }
  }

  private rejectAll(err: Error) {
    for (const [, p] of this.pending) p.reject(err);
    this.pending.clear();
  }

  dispose(): void {
    this.rejectAll(new Error("Client disposed"));
    for (const u of this.unsubs) u();
    this.unsubs = [];
    this.transport.close();
  }
}
