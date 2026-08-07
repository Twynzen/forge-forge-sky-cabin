import { EventEmitter } from "node:events";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";
//#region node_modules/.nitro/vite/services/ssr/assets/hub-OAmgNCE1.js
var nextId = 1;
function createRequestId() {
	return nextId++;
}
function makeRequest(method, params, id) {
	return {
		jsonrpc: "2.0",
		id: id ?? createRequestId(),
		method,
		params
	};
}
function makeNotification(method, params) {
	return {
		jsonrpc: "2.0",
		method,
		params
	};
}
function makeResult(id, result) {
	return {
		jsonrpc: "2.0",
		id,
		result
	};
}
function parseMessage(line) {
	const trimmed = line.trim();
	if (!trimmed) return null;
	try {
		return JSON.parse(trimmed);
	} catch {
		return null;
	}
}
function serializeMessage(msg) {
	return JSON.stringify(msg) + "\n";
}
function isRequest(msg) {
	return "method" in msg && "id" in msg && msg.id !== void 0;
}
function isNotification(msg) {
	return "method" in msg && !("id" in msg);
}
function isResponse(msg) {
	return "id" in msg && !("method" in msg);
}
var AcpClient = class {
	transport;
	pending = /* @__PURE__ */ new Map();
	unsubs = [];
	initialized = false;
	agentInfo = null;
	options;
	constructor(options) {
		this.options = options;
		this.transport = options.transport;
		this.unsubs.push(this.transport.onMessage((msg) => this.handleMessage(msg)));
		this.unsubs.push(this.transport.onClose((code) => {
			this.rejectAll(/* @__PURE__ */ new Error(`Agent closed (${code})`));
			options.onClose?.(code);
		}));
		this.unsubs.push(this.transport.onError((err) => {
			options.onError?.(err);
		}));
	}
	get isInitialized() {
		return this.initialized;
	}
	get info() {
		return this.agentInfo;
	}
	async initialize() {
		const params = {
			protocolVersion: 1,
			clientInfo: {
				name: this.options.clientName ?? "Sendell Remote Control",
				version: this.options.clientVersion ?? "1.0.0"
			},
			capabilities: {
				fs: {
					readTextFile: true,
					writeTextFile: true
				},
				terminal: true
			}
		};
		const result = await this.request("initialize", params);
		this.agentInfo = result;
		this.initialized = true;
		this.notify("authenticated", {});
		return result;
	}
	async newSession(params) {
		return await this.request("session/new", params);
	}
	async prompt(params) {
		return await this.request("session/prompt", params);
	}
	cancel(params) {
		this.notify("session/cancel", params);
	}
	request(method, params) {
		const id = createRequestId();
		return new Promise((resolve, reject) => {
			this.pending.set(id, {
				resolve,
				reject
			});
			this.transport.send(makeRequest(method, params, id));
		});
	}
	notify(method, params) {
		this.transport.send({
			jsonrpc: "2.0",
			method,
			params
		});
	}
	async handleMessage(msg) {
		if (isResponse(msg)) {
			const pending = this.pending.get(msg.id);
			if (!pending) return;
			this.pending.delete(msg.id);
			if (msg.error) pending.reject(new Error(msg.error.message));
			else pending.resolve(msg.result);
			return;
		}
		if (isNotification(msg)) {
			if (msg.method === "session/update") this.options.onSessionUpdate?.(msg.params);
			return;
		}
		if (isRequest(msg)) await this.handleAgentRequest(msg);
	}
	async handleAgentRequest(msg) {
		try {
			if (msg.method === "session/request_permission") {
				const params = msg.params;
				const handler = this.options.onPermissionRequest;
				const result = handler ? await handler(params) : { outcome: {
					outcome: "selected",
					optionId: "allow-once"
				} };
				this.transport.send(makeResult(msg.id, result));
				return;
			}
			if (msg.method === "fs/read_text_file" || msg.method === "fs/write_text_file" || msg.method.startsWith("terminal/")) {
				const handler = this.options.onClientMethod;
				if (handler) {
					const result = await handler(msg.method, msg.params, msg.id);
					this.transport.send(makeResult(msg.id, result ?? {}));
				} else if (msg.method === "fs/read_text_file") this.transport.send(makeResult(msg.id, { content: "// (remote control: filesystem not bridged)\n" }));
				else this.transport.send(makeResult(msg.id, {}));
				return;
			}
			this.transport.send(makeResult(msg.id, { ok: true }));
		} catch (err) {
			this.transport.send({
				jsonrpc: "2.0",
				id: msg.id,
				error: {
					code: -32e3,
					message: err instanceof Error ? err.message : "Client handler error"
				}
			});
		}
	}
	rejectAll(err) {
		for (const [, p] of this.pending) p.reject(err);
		this.pending.clear();
	}
	dispose() {
		this.rejectAll(/* @__PURE__ */ new Error("Client disposed"));
		for (const u of this.unsubs) u();
		this.unsubs = [];
		this.transport.close();
	}
};
/**
* ACP transport abstractions.
* - StdioTransport: real agent subprocess (local/VPS)
* - MemoryTransport: in-process simulated agent (demo)
*/
/** Line-buffered JSON-RPC over child process stdio */
var StdioTransport = class {
	kind = "stdio";
	proc;
	buffer = "";
	closed = false;
	emitter = new EventEmitter();
	constructor(command, args, options) {
		this.proc = spawn(command, args, {
			cwd: options?.cwd,
			env: {
				...process.env,
				...options?.env
			},
			stdio: [
				"pipe",
				"pipe",
				"pipe"
			]
		});
		this.proc.stdout.setEncoding("utf8");
		this.proc.stdout.on("data", (chunk) => this.onData(chunk));
		this.proc.stderr.setEncoding("utf8");
		this.proc.stderr.on("data", (chunk) => {
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
	onData(chunk) {
		this.buffer += chunk;
		const lines = this.buffer.split("\n");
		this.buffer = lines.pop() ?? "";
		for (const line of lines) {
			const msg = parseMessage(line);
			if (msg) this.emitter.emit("message", msg);
		}
	}
	send(message) {
		if (this.closed || !this.proc.stdin.writable) return;
		this.proc.stdin.write(serializeMessage(message));
	}
	onMessage(handler) {
		this.emitter.on("message", handler);
		return () => this.emitter.off("message", handler);
	}
	onClose(handler) {
		this.emitter.on("close", handler);
		return () => this.emitter.off("close", handler);
	}
	onError(handler) {
		this.emitter.on("error", handler);
		return () => this.emitter.off("error", handler);
	}
	close() {
		if (this.closed) return;
		this.closed = true;
		try {
			this.proc.stdin.end();
			this.proc.kill("SIGTERM");
		} catch {}
	}
	isAlive() {
		return !this.closed && this.proc.exitCode === null;
	}
};
/**
* In-process transport for simulated ACP agents.
* The agent side registers as `agentHandler`.
*/
var MemoryTransport = class {
	kind = "memory";
	closed = false;
	clientHandlers = /* @__PURE__ */ new Set();
	agentHandlers = /* @__PURE__ */ new Set();
	closeHandlers = /* @__PURE__ */ new Set();
	errorHandlers = /* @__PURE__ */ new Set();
	/** Client → Agent */
	send(message) {
		if (this.closed) return;
		queueMicrotask(() => {
			for (const h of this.agentHandlers) h(message);
		});
	}
	/** Agent → Client */
	agentSend(message) {
		if (this.closed) return;
		queueMicrotask(() => {
			for (const h of this.clientHandlers) h(message);
		});
	}
	onMessage(handler) {
		this.clientHandlers.add(handler);
		return () => this.clientHandlers.delete(handler);
	}
	/** Agent listens for client messages */
	onAgentMessage(handler) {
		this.agentHandlers.add(handler);
		return () => this.agentHandlers.delete(handler);
	}
	onClose(handler) {
		this.closeHandlers.add(handler);
		return () => this.closeHandlers.delete(handler);
	}
	onError(handler) {
		this.errorHandlers.add(handler);
		return () => this.errorHandlers.delete(handler);
	}
	close() {
		if (this.closed) return;
		this.closed = true;
		for (const h of this.closeHandlers) h(0);
	}
	isAlive() {
		return !this.closed;
	}
};
function sleep(ms) {
	return new Promise((r) => setTimeout(r, ms));
}
function uid$2(prefix) {
	return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
/** Very small “agent” that answers coding-style prompts with tools */
var SimulatedAcpAgent = class {
	transport;
	sessions = /* @__PURE__ */ new Set();
	cancelled = /* @__PURE__ */ new Set();
	unsub = null;
	model;
	constructor(transport, model = "grok-build-sim") {
		this.transport = transport;
		this.model = model;
		this.unsub = transport.onAgentMessage((msg) => {
			this.handle(msg);
		});
	}
	dispose() {
		this.unsub?.();
		this.unsub = null;
	}
	async handle(msg) {
		if (isNotification(msg)) {
			if (msg.method === "session/cancel") {
				const sid = msg.params?.sessionId;
				if (sid) this.cancelled.add(sid);
			}
			return;
		}
		if (!isRequest(msg)) return;
		switch (msg.method) {
			case "initialize":
				this.transport.agentSend(makeResult(msg.id, {
					protocolVersion: 1,
					agentCapabilities: {
						loadSession: false,
						promptCapabilities: {
							image: false,
							audio: false
						}
					},
					agentInfo: {
						name: "Grok Build (Simulated)",
						version: "1.0.0-sim"
					},
					authMethods: []
				}));
				return;
			case "session/new": {
				const sessionId = uid$2("acp");
				this.sessions.add(sessionId);
				this.transport.agentSend(makeResult(msg.id, { sessionId }));
				return;
			}
			case "session/prompt":
				await this.handlePrompt(msg);
				return;
			default: this.transport.agentSend(makeResult(msg.id, { ok: true }));
		}
	}
	emitUpdate(sessionId, update) {
		this.transport.agentSend(makeNotification("session/update", {
			sessionId,
			update
		}));
	}
	async streamText(sessionId, kind, text, delayMs = 18) {
		const words = text.split(/(\s+)/);
		for (const w of words) {
			if (this.cancelled.has(sessionId)) return;
			this.emitUpdate(sessionId, {
				sessionUpdate: kind,
				content: {
					type: "text",
					text: w
				}
			});
			await sleep(delayMs);
		}
	}
	async requestPermission(sessionId, toolCallId, title, kind, rawInput) {
		const params = {
			sessionId,
			toolCall: {
				toolCallId,
				title,
				kind,
				status: "pending",
				rawInput
			},
			options: [
				{
					optionId: "allow-once",
					name: "Allow once",
					kind: "allow_once"
				},
				{
					optionId: "allow-always",
					name: "Allow always",
					kind: "allow_always"
				},
				{
					optionId: "reject-once",
					name: "Reject",
					kind: "reject_once"
				}
			]
		};
		return new Promise((resolve) => {
			const id = uid$2("perm");
			this.transport.onAgentMessage((msg) => {
				if (!isRequest(msg) && "id" in msg && msg.id === id) {}
			});
			const onResp = (msg) => {
				if (!("id" in msg) || msg.id !== id) return;
				this.transport.onAgentMessage(() => {});
				const result = msg.result;
				const optionId = result?.outcome?.optionId ?? "";
				const rejected = result?.outcome?.outcome === "cancelled" || optionId.startsWith("reject");
				cleanup();
				resolve(rejected ? "reject" : "allow");
			};
			const cleanupInner = this.transport.onAgentMessage(onResp);
			const cleanup = () => cleanupInner();
			this.transport.agentSend({
				jsonrpc: "2.0",
				id,
				method: "session/request_permission",
				params
			});
		});
	}
	async handlePrompt(msg) {
		const params = msg.params;
		const sessionId = params.sessionId;
		this.cancelled.delete(sessionId);
		const userText = params.prompt?.filter((p) => p.type === "text").map((p) => p.text ?? "").join("\n").trim() || "(empty)";
		try {
			this.emitUpdate(sessionId, {
				sessionUpdate: "plan",
				entries: [
					{
						content: "Understand the request",
						status: "in_progress",
						priority: "high"
					},
					{
						content: "Inspect relevant files",
						status: "pending",
						priority: "medium"
					},
					{
						content: "Apply changes / answer",
						status: "pending",
						priority: "high"
					}
				]
			});
			await this.streamText(sessionId, "agent_thought_chunk", `Analyzing request for ${this.model}: "${userText.slice(0, 120)}${userText.length > 120 ? "…" : ""}". I'll inspect the workspace and respond with a concrete plan.`, 12);
			if (this.cancelled.has(sessionId)) {
				this.transport.agentSend(makeResult(msg.id, { stopReason: "cancelled" }));
				return;
			}
			const readId = uid$2("tool");
			this.emitUpdate(sessionId, {
				sessionUpdate: "tool_call",
				toolCallId: readId,
				title: "Read project structure",
				kind: "read",
				status: "pending",
				rawInput: {
					path: "/workspace",
					recursive: true
				},
				locations: [{ path: "/workspace" }]
			});
			if (await this.requestPermission(sessionId, readId, "Read project structure", "read", {
				path: "/workspace",
				recursive: true
			}) === "reject") {
				this.emitUpdate(sessionId, {
					sessionUpdate: "tool_call_update",
					toolCallId: readId,
					status: "failed",
					content: [{
						type: "content",
						text: "Permission denied by operator"
					}]
				});
				await this.streamText(sessionId, "agent_message_chunk", "I couldn't inspect the workspace because the tool call was rejected. Tell me what you need and I'll answer from context alone, or approve a read so I can dig into the code.", 14);
				this.transport.agentSend(makeResult(msg.id, { stopReason: "end_turn" }));
				return;
			}
			this.emitUpdate(sessionId, {
				sessionUpdate: "tool_call_update",
				toolCallId: readId,
				status: "in_progress"
			});
			await sleep(400);
			this.emitUpdate(sessionId, {
				sessionUpdate: "tool_call_update",
				toolCallId: readId,
				status: "completed",
				content: [{
					type: "content",
					text: "src/\n  routes/\n  lib/hub/\n  components/sendell/\npackage.json\nREADME.md"
				}]
			});
			const wantsWrite = /\b(fix|edit|change|implement|add|create|refactor|write)\b/i.test(userText);
			if (wantsWrite) {
				const editId = uid$2("tool");
				this.emitUpdate(sessionId, {
					sessionUpdate: "tool_call",
					toolCallId: editId,
					title: "Propose code edit",
					kind: "edit",
					status: "pending",
					rawInput: {
						path: "src/lib/hub/hub.ts",
						description: "Apply requested change"
					},
					locations: [{ path: "src/lib/hub/hub.ts" }]
				});
				if (await this.requestPermission(sessionId, editId, "Propose code edit", "edit", { path: "src/lib/hub/hub.ts" }) === "allow") this.emitUpdate(sessionId, {
					sessionUpdate: "tool_call_update",
					toolCallId: editId,
					status: "completed",
					content: [{
						type: "diff",
						text: "@@ -1,3 +1,5 @@\n+// applied by Sendell Remote Control demo\n"
					}]
				});
				else this.emitUpdate(sessionId, {
					sessionUpdate: "tool_call_update",
					toolCallId: editId,
					status: "failed",
					content: [{
						type: "content",
						text: "Edit rejected"
					}]
				});
			}
			this.emitUpdate(sessionId, {
				sessionUpdate: "plan",
				entries: [
					{
						content: "Understand the request",
						status: "completed",
						priority: "high"
					},
					{
						content: "Inspect relevant files",
						status: "completed",
						priority: "medium"
					},
					{
						content: "Apply changes / answer",
						status: "in_progress",
						priority: "high"
					}
				]
			});
			const answer = buildSimulatedAnswer(userText, wantsWrite);
			await this.streamText(sessionId, "agent_message_chunk", answer, 16);
			this.emitUpdate(sessionId, {
				sessionUpdate: "plan",
				entries: [
					{
						content: "Understand the request",
						status: "completed",
						priority: "high"
					},
					{
						content: "Inspect relevant files",
						status: "completed",
						priority: "medium"
					},
					{
						content: "Apply changes / answer",
						status: "completed",
						priority: "high"
					}
				]
			});
			this.transport.agentSend(makeResult(msg.id, { stopReason: this.cancelled.has(sessionId) ? "cancelled" : "end_turn" }));
		} catch (err) {
			this.transport.agentSend({
				jsonrpc: "2.0",
				id: msg.id,
				error: {
					code: -32e3,
					message: err instanceof Error ? err.message : "Simulated agent error"
				}
			});
		}
	}
};
function buildSimulatedAnswer(userText, wantsWrite) {
	if (wantsWrite) return `I'm **Grok Build** running through **Sendell Remote Control** (simulated ACP session). You asked me to work on: “${userText.slice(0, 200)}”.\n\nHere's what I did via ACP:
1. Created a plan and streamed thoughts
2. Requested permission for a **read** tool call
3. Requested permission for an **edit** tool call
4. Streamed this final answer

In a real VPS/local setup, the Grok Build adapter talks to the \`grok\` CLI over stdio using the same JSON-RPC methods (\`initialize\` → \`session/new\` → \`session/prompt\`). Approve or reject tool calls from your phone to keep full control of the agent.`;
	return `I'm **Grok Build** running through **Sendell Remote Control** (simulated ACP session). Regarding: “${userText.slice(0, 240)}”.\n\nSendell Remote Control is a multi-provider hub. This session uses the **Agent Client Protocol**:
- \`session/update\` streams thoughts, messages, and tool calls
- \`session/request_permission\` gates risky tools until you approve
- Multiple sessions can run concurrently with different providers

Try asking me to **implement** or **fix** something to see edit permissions. Or open another session from the sidebar to control several agents at once.`;
}
/**
* Grok Build adapter — primary provider.
*
* Uses Agent Client Protocol (ACP) over:
* - stdio → real `grok` CLI when available (local / VPS)
* - memory → SimulatedAcpAgent for demos and preview
*
* Architecture note: this is the reference adapter. Clone this file
* to add Claude Code, Gemini CLI, etc.
*/
function uid$1(prefix) {
	return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
function mapToolKind(kind) {
	const k = (kind ?? "other").toLowerCase();
	if (k.includes("read")) return "read";
	if (k.includes("edit") || k.includes("write")) return "edit";
	if (k.includes("delete")) return "delete";
	if (k.includes("move") || k.includes("rename")) return "move";
	if (k.includes("search") || k.includes("grep") || k.includes("find")) return "search";
	if (k.includes("exec") || k.includes("bash") || k.includes("shell") || k.includes("terminal")) return "execute";
	if (k.includes("think")) return "think";
	if (k.includes("fetch") || k.includes("http") || k.includes("web")) return "fetch";
	return "other";
}
function toJsonValue(value) {
	if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
	if (Array.isArray(value)) return value.map(toJsonValue);
	if (typeof value === "object") {
		const out = {};
		for (const [k, v] of Object.entries(value)) out[k] = toJsonValue(v);
		return out;
	}
	return String(value);
}
function toInputRecord(raw) {
	if (raw === void 0 || raw === null) return void 0;
	if (typeof raw === "object" && !Array.isArray(raw)) return toJsonValue(raw);
	return { value: toJsonValue(raw) };
}
var live = /* @__PURE__ */ new Map();
async function commandExists(cmd) {
	const paths = (process.env.PATH ?? "").split(":").filter(Boolean);
	for (const dir of paths) try {
		await access(`${dir}/${cmd}`, constants.X_OK);
		return true;
	} catch {}
	return false;
}
var grokBuildInfo = {
	id: "grok-build",
	name: "Grok Build",
	description: "xAI coding agent via Agent Client Protocol (ACP)",
	available: true,
	transport: "acp-stdio",
	accent: "accent",
	icon: "sparkles"
};
var GrokBuildAdapter = class {
	id = "grok-build";
	info = grokBuildInfo;
	async isAvailable() {
		return true;
	}
	async createSession(input, ctx) {
		const hasGrok = !(input.demo !== false) && await commandExists("grok");
		const cwd = input.cwd || process.cwd();
		ctx.emitStatus("connecting");
		let transport;
		let simAgent;
		let demo = true;
		if (hasGrok) {
			transport = new StdioTransport(process.env.SENDELL_GROK_ACP_CMD || "grok", (process.env.SENDELL_GROK_ACP_ARGS || "acp").split(/\s+/).filter(Boolean), {
				cwd,
				env: { XAI_API_KEY: process.env.XAI_API_KEY }
			});
			demo = false;
		} else {
			transport = new MemoryTransport();
			simAgent = new SimulatedAcpAgent(transport, input.model || "grok-build-sim");
		}
		const liveSession = {
			client: null,
			remoteSessionId: "",
			simAgent,
			permissionWaiters: /* @__PURE__ */ new Map(),
			streamingMessageId: null,
			thoughtMessageId: null
		};
		const client = new AcpClient({
			transport,
			clientName: "Sendell Remote Control",
			clientVersion: "1.0.0",
			onSessionUpdate: (params) => this.onUpdate(params, ctx, liveSession),
			onPermissionRequest: (params) => this.onPermission(params, ctx, liveSession),
			onError: (err) => {
				if (!demo) ctx.emitStatus("error", err.message);
			},
			onClose: () => {
				if (ctx.meta.status !== "closed") ctx.emitStatus("closed");
			}
		});
		liveSession.client = client;
		try {
			await client.initialize();
			const session = await client.newSession({
				cwd,
				mcpServers: []
			});
			liveSession.remoteSessionId = session.sessionId;
			live.set(ctx.hubSessionId, liveSession);
			ctx.emitStatus("ready");
			ctx.meta.demo = demo;
			ctx.meta.remoteSessionId = session.sessionId;
			const welcome = {
				id: uid$1("msg"),
				role: "system",
				content: [{
					type: "text",
					text: demo ? "Connected to **Grok Build** (simulated ACP). Tool calls require your approval. Try: “Explain the hub architecture” or “Implement a dark mode toggle”." : "Connected to **Grok Build** via ACP stdio. You are controlling a live agent session."
				}],
				createdAt: Date.now()
			};
			ctx.emitMessageAppended(welcome);
			return {
				remoteSessionId: session.sessionId,
				model: input.model || (demo ? "grok-build-sim" : "grok-build")
			};
		} catch (err) {
			simAgent?.dispose();
			client.dispose();
			ctx.emitStatus("error", err instanceof Error ? err.message : "Failed to start Grok Build session");
			throw err;
		}
	}
	async sendPrompt(text, ctx) {
		const liveSession = live.get(ctx.hubSessionId);
		if (!liveSession) throw new Error("Session not connected");
		const userMsg = {
			id: uid$1("msg"),
			role: "user",
			content: [{
				type: "text",
				text
			}],
			createdAt: Date.now()
		};
		ctx.emitMessageAppended(userMsg);
		ctx.emitStatus("thinking");
		liveSession.streamingMessageId = null;
		liveSession.thoughtMessageId = null;
		try {
			await liveSession.client.prompt({
				sessionId: liveSession.remoteSessionId,
				prompt: [{
					type: "text",
					text
				}]
			});
			this.finalizeStreaming(ctx, liveSession);
			ctx.emitStatus("ready");
		} catch (err) {
			this.finalizeStreaming(ctx, liveSession);
			ctx.emitStatus("error", err instanceof Error ? err.message : "Prompt failed");
			throw err;
		}
	}
	async resolvePermission(input, ctx) {
		const liveSession = live.get(ctx.hubSessionId);
		if (!liveSession) return;
		const waiter = liveSession.permissionWaiters.get(input.toolCallId);
		if (waiter) {
			liveSession.permissionWaiters.delete(input.toolCallId);
			waiter(input.decision);
		}
	}
	async cancel(ctx) {
		const liveSession = live.get(ctx.hubSessionId);
		if (!liveSession) return;
		liveSession.client.cancel({ sessionId: liveSession.remoteSessionId });
		this.finalizeStreaming(ctx, liveSession);
		ctx.emitStatus("ready");
	}
	async disposeSession(ctx) {
		const liveSession = live.get(ctx.hubSessionId);
		if (!liveSession) return;
		liveSession.simAgent?.dispose();
		liveSession.client.dispose();
		live.delete(ctx.hubSessionId);
	}
	finalizeStreaming(ctx, liveSession) {
		for (const id of [liveSession.streamingMessageId, liveSession.thoughtMessageId]) {
			if (!id) continue;
			const msg = ctx.getMessages().find((m) => m.id === id);
			if (msg?.streaming) ctx.emitMessageUpdated({
				...msg,
				streaming: false
			});
		}
		liveSession.streamingMessageId = null;
		liveSession.thoughtMessageId = null;
	}
	onUpdate(params, ctx, liveSession) {
		const u = params.update;
		switch (u.sessionUpdate) {
			case "agent_thought_chunk": {
				ctx.emitStatus("thinking");
				const text = u.content?.text ?? "";
				if (!liveSession.thoughtMessageId) {
					const msg = {
						id: uid$1("msg"),
						role: "thought",
						content: [{
							type: "text",
							text
						}],
						createdAt: Date.now(),
						streaming: true
					};
					liveSession.thoughtMessageId = msg.id;
					ctx.emitMessageAppended(msg);
				} else ctx.emitMessageChunk(liveSession.thoughtMessageId, text, "thought");
				break;
			}
			case "agent_message_chunk": {
				ctx.emitStatus("streaming");
				if (liveSession.thoughtMessageId) {
					const t = ctx.getMessages().find((m) => m.id === liveSession.thoughtMessageId);
					if (t?.streaming) ctx.emitMessageUpdated({
						...t,
						streaming: false
					});
					liveSession.thoughtMessageId = null;
				}
				const text = u.content?.text ?? "";
				if (!liveSession.streamingMessageId) {
					const msg = {
						id: uid$1("msg"),
						role: "assistant",
						content: [{
							type: "text",
							text
						}],
						createdAt: Date.now(),
						streaming: true
					};
					liveSession.streamingMessageId = msg.id;
					ctx.emitMessageAppended(msg);
				} else ctx.emitMessageChunk(liveSession.streamingMessageId, text, "assistant");
				break;
			}
			case "tool_call": {
				const tool = {
					id: u.toolCallId,
					title: u.title || "Tool call",
					kind: mapToolKind(u.kind),
					status: "pending",
					input: toInputRecord(u.rawInput),
					permissionRequired: true,
					createdAt: Date.now(),
					updatedAt: Date.now()
				};
				const msg = {
					id: uid$1("msg"),
					role: "assistant",
					content: [{
						type: "tool_call",
						toolCall: tool
					}],
					createdAt: Date.now()
				};
				ctx.emitMessageAppended(msg);
				ctx.emitToolUpdated(tool);
				break;
			}
			case "tool_call_update": {
				const status = {
					pending: "pending",
					in_progress: "running",
					completed: "completed",
					failed: "failed"
				}[u.status ?? ""] ?? "running";
				const output = u.content?.map((c) => c.text ?? "").filter(Boolean).join("\n") || void 0;
				const messages = ctx.getMessages();
				for (const m of messages) for (let i = 0; i < m.content.length; i++) {
					const block = m.content[i];
					if (block.type === "tool_call" && block.toolCall.id === u.toolCallId) {
						const updated = {
							...block.toolCall,
							status,
							output: output ?? block.toolCall.output,
							updatedAt: Date.now()
						};
						const newContent = [...m.content];
						newContent[i] = {
							type: "tool_call",
							toolCall: updated
						};
						ctx.emitMessageUpdated({
							...m,
							content: newContent
						});
						ctx.emitToolUpdated(updated);
						return;
					}
				}
				ctx.emitToolUpdated({
					id: u.toolCallId,
					title: u.title || "Tool call",
					kind: "other",
					status,
					output,
					createdAt: Date.now(),
					updatedAt: Date.now()
				});
				break;
			}
			case "plan": {
				const steps = u.entries.map((e, idx) => ({
					id: `plan_${idx}`,
					title: e.content,
					status: e.status === "completed" ? "completed" : e.status === "in_progress" ? "in_progress" : e.status === "failed" ? "failed" : "pending"
				}));
				ctx.emitPlanUpdated(steps);
				const existing = ctx.getMessages().find((m) => m.content.some((c) => c.type === "plan"));
				if (existing) ctx.emitMessageUpdated({
					...existing,
					content: [{
						type: "plan",
						steps
					}]
				});
				else ctx.emitMessageAppended({
					id: uid$1("msg"),
					role: "assistant",
					content: [{
						type: "plan",
						steps
					}],
					createdAt: Date.now()
				});
				break;
			}
		}
	}
	onPermission(params, ctx, liveSession) {
		const toolCallId = params.toolCall.toolCallId;
		const tool = {
			id: toolCallId,
			title: params.toolCall.title || "Permission required",
			kind: mapToolKind(params.toolCall.kind),
			status: "awaiting_permission",
			input: toInputRecord(params.toolCall.rawInput),
			permissionRequired: true,
			createdAt: Date.now(),
			updatedAt: Date.now()
		};
		const messages = ctx.getMessages();
		let found = false;
		for (const m of messages) for (let i = 0; i < m.content.length; i++) {
			const block = m.content[i];
			if (block.type === "tool_call" && block.toolCall.id === toolCallId) {
				const newContent = [...m.content];
				newContent[i] = {
					type: "tool_call",
					toolCall: tool
				};
				ctx.emitMessageUpdated({
					...m,
					content: newContent
				});
				found = true;
			}
		}
		if (!found) ctx.emitMessageAppended({
			id: uid$1("msg"),
			role: "assistant",
			content: [{
				type: "tool_call",
				toolCall: tool
			}],
			createdAt: Date.now()
		});
		ctx.setPendingPermission(tool);
		ctx.emitPermissionRequested(tool);
		ctx.emitStatus("awaiting_permission");
		return new Promise((resolve) => {
			liveSession.permissionWaiters.set(toolCallId, (decision) => {
				const optionId = decision === "allow" ? "allow-once" : decision === "allow_always" ? "allow-always" : "reject-once";
				const updated = {
					...tool,
					status: decision === "reject" ? "rejected" : "running",
					updatedAt: Date.now()
				};
				for (const m of ctx.getMessages()) for (let i = 0; i < m.content.length; i++) {
					const block = m.content[i];
					if (block.type === "tool_call" && block.toolCall.id === toolCallId) {
						const newContent = [...m.content];
						newContent[i] = {
							type: "tool_call",
							toolCall: updated
						};
						ctx.emitMessageUpdated({
							...m,
							content: newContent
						});
					}
				}
				ctx.emitToolUpdated(updated);
				ctx.setPendingPermission(null);
				ctx.emitStatus("streaming");
				resolve({ outcome: decision === "reject" ? {
					outcome: "selected",
					optionId: "reject-once"
				} : {
					outcome: "selected",
					optionId
				} });
			});
		});
	}
};
var grokBuildAdapter = new GrokBuildAdapter();
function makeStub(info) {
	return {
		id: info.id,
		info,
		async isAvailable() {
			return false;
		},
		async createSession(_input, _ctx) {
			throw new Error(`${info.name} adapter is not implemented yet. See docs/ARCHITECTURE.md — "Adding a provider".`);
		},
		async sendPrompt() {
			throw new Error("Not implemented");
		}
	};
}
var claudeCodeAdapter = makeStub({
	id: "claude-code",
	name: "Claude Code",
	description: "Anthropic Claude Code via ACP (roadmap)",
	available: false,
	transport: "stub",
	accent: "muted",
	icon: "bot"
});
var geminiAdapter = makeStub({
	id: "gemini",
	name: "Gemini CLI",
	description: "Google Gemini coding agent via ACP (roadmap)",
	available: false,
	transport: "stub",
	accent: "muted",
	icon: "hexagon"
});
var gptAdapter = makeStub({
	id: "gpt",
	name: "GPT / Codex",
	description: "OpenAI Codex CLI via ACP (roadmap)",
	available: false,
	transport: "stub",
	accent: "muted",
	icon: "cpu"
});
var adapters = /* @__PURE__ */ new Map([
	["grok-build", grokBuildAdapter],
	["claude-code", claudeCodeAdapter],
	["gemini", geminiAdapter],
	["gpt", gptAdapter]
]);
function getAdapter(id) {
	const a = adapters.get(id);
	if (!a) throw new Error(`Unknown provider: ${id}`);
	return a;
}
async function listProviderInfos() {
	const result = [];
	for (const a of adapters.values()) {
		const available = await a.isAvailable();
		result.push({
			...a.info,
			available
		});
	}
	return result;
}
/**
* Sendell Hub — central session orchestrator.
*
* Frontend ↔ Hub ↔ Provider Adapters
*
* Singleton in-process (dev + single-node deploy). For multi-instance
* production, swap the EventBus + SessionStore for Redis/NATS later.
*/
function uid(prefix) {
	return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
var Hub = class {
	sessions = /* @__PURE__ */ new Map();
	bus = new EventEmitter();
	seeded = false;
	constructor() {
		this.bus.setMaxListeners(200);
	}
	/** Subscribe to hub events (all sessions or one). Returns unsubscribe. */
	subscribe(handler, sessionId) {
		const wrapped = (event) => {
			if (!sessionId) {
				handler(event);
				return;
			}
			if ("sessionId" in event && event.sessionId === sessionId) {
				handler(event);
				return;
			}
			if (event.type === "session.created" && event.session.id === sessionId) {
				handler(event);
				return;
			}
			if (event.type === "session.updated" && event.session.id === sessionId) {
				handler(event);
				return;
			}
			if (event.type === "session.removed" && event.sessionId === sessionId) {
				handler(event);
				return;
			}
			if (event.type === "heartbeat") handler(event);
		};
		this.bus.on("event", wrapped);
		return () => this.bus.off("event", wrapped);
	}
	emit(event) {
		this.bus.emit("event", event);
	}
	touch(session, patch) {
		session.meta = {
			...session.meta,
			...patch,
			updatedAt: Date.now()
		};
		session.rev += 1;
		this.emit({
			type: "session.updated",
			session: { ...session.meta }
		});
	}
	async listProviders() {
		return listProviderInfos();
	}
	listSessions() {
		return Array.from(this.sessions.values()).map((s) => ({ ...s.meta })).sort((a, b) => b.updatedAt - a.updatedAt);
	}
	getSnapshot(sessionId) {
		const s = this.sessions.get(sessionId);
		if (!s) return null;
		return {
			...s.meta,
			messages: s.messages.map((m) => ({
				...m,
				content: m.content.map((c) => c.type === "tool_call" ? {
					...c,
					toolCall: { ...c.toolCall }
				} : c.type === "plan" ? {
					...c,
					steps: c.steps.map((x) => ({ ...x }))
				} : { ...c })
			})),
			pendingPermissions: s.pendingPermissions.map((t) => ({ ...t })),
			plan: s.plan?.map((p) => ({ ...p }))
		};
	}
	buildCtx(sessionId) {
		const ensure = () => {
			const s = this.sessions.get(sessionId);
			if (!s) throw new Error(`Session ${sessionId} not found`);
			return s;
		};
		return {
			hubSessionId: sessionId,
			get meta() {
				return ensure().meta;
			},
			emitMessageAppended: (message) => {
				const s = ensure();
				s.messages.push(message);
				s.rev += 1;
				this.emit({
					type: "message.appended",
					sessionId,
					message
				});
				this.touch(s, {});
			},
			emitMessageUpdated: (message) => {
				const s = ensure();
				const idx = s.messages.findIndex((m) => m.id === message.id);
				if (idx >= 0) s.messages[idx] = message;
				s.rev += 1;
				this.emit({
					type: "message.updated",
					sessionId,
					message
				});
			},
			emitMessageChunk: (messageId, chunk, role) => {
				const s = ensure();
				const msg = s.messages.find((m) => m.id === messageId);
				if (msg) {
					const textBlock = msg.content.find((c) => c.type === "text");
					if (textBlock && textBlock.type === "text") textBlock.text += chunk;
					else msg.content.push({
						type: "text",
						text: chunk
					});
					msg.streaming = true;
					s.rev += 1;
				}
				this.emit({
					type: "message.chunk",
					sessionId,
					messageId,
					chunk,
					role
				});
			},
			emitToolUpdated: (toolCall) => {
				this.emit({
					type: "tool.updated",
					sessionId,
					toolCall
				});
			},
			emitPermissionRequested: (toolCall) => {
				const s = ensure();
				s.pendingPermissions = [...s.pendingPermissions.filter((t) => t.id !== toolCall.id), toolCall];
				this.touch(s, { status: "awaiting_permission" });
				this.emit({
					type: "permission.requested",
					sessionId,
					toolCall
				});
			},
			emitPlanUpdated: (steps) => {
				const s = ensure();
				s.plan = steps;
				this.emit({
					type: "plan.updated",
					sessionId,
					steps
				});
			},
			emitStatus: (status, error) => {
				const s = ensure();
				this.touch(s, {
					status,
					lastError: error
				});
			},
			getMessages: () => ensure().messages,
			getPendingPermissions: () => ensure().pendingPermissions,
			setPendingPermission: (tool) => {
				const s = ensure();
				if (!tool) s.pendingPermissions = [];
				else s.pendingPermissions = [...s.pendingPermissions.filter((t) => t.id !== tool.id), tool];
			}
		};
	}
	async createSession(input) {
		const id = uid("sess");
		const now = Date.now();
		const providerId = input.providerId || "grok-build";
		const adapter = getAdapter(providerId);
		const meta = {
			id,
			title: input.title || defaultTitle(providerId),
			providerId,
			status: "connecting",
			cwd: input.cwd || process.cwd(),
			model: input.model,
			createdAt: now,
			updatedAt: now,
			demo: input.demo !== false
		};
		const internal = {
			meta,
			messages: [],
			pendingPermissions: [],
			rev: 1
		};
		this.sessions.set(id, internal);
		this.emit({
			type: "session.created",
			session: { ...meta }
		});
		const ctx = this.buildCtx(id);
		try {
			const result = await adapter.createSession({
				...input,
				providerId,
				demo: meta.demo
			}, ctx);
			this.touch(internal, {
				remoteSessionId: result.remoteSessionId,
				model: result.model || meta.model,
				status: "ready"
			});
		} catch (err) {
			this.touch(internal, {
				status: "error",
				lastError: err instanceof Error ? err.message : "create failed"
			});
		}
		return this.getSnapshot(id);
	}
	async sendPrompt(input) {
		const s = this.sessions.get(input.sessionId);
		if (!s) throw new Error("Session not found");
		if (!input.text.trim()) throw new Error("Empty prompt");
		if (s.messages.filter((m) => m.role === "user").length === 0) {
			const title = input.text.trim().slice(0, 48) + (input.text.trim().length > 48 ? "…" : "");
			this.touch(s, { title });
		}
		const adapter = getAdapter(s.meta.providerId);
		const ctx = this.buildCtx(input.sessionId);
		await adapter.sendPrompt(input.text.trim(), ctx);
	}
	async resolvePermission(input) {
		const s = this.sessions.get(input.sessionId);
		if (!s) throw new Error("Session not found");
		const adapter = getAdapter(s.meta.providerId);
		const ctx = this.buildCtx(input.sessionId);
		if (!adapter.resolvePermission) throw new Error("Provider does not support permission resolution");
		await adapter.resolvePermission(input, ctx);
	}
	async cancelSession(sessionId) {
		const s = this.sessions.get(sessionId);
		if (!s) return;
		const adapter = getAdapter(s.meta.providerId);
		if (adapter.cancel) await adapter.cancel(this.buildCtx(sessionId));
	}
	async closeSession(sessionId) {
		const s = this.sessions.get(sessionId);
		if (!s) return;
		const adapter = getAdapter(s.meta.providerId);
		if (adapter.disposeSession) await adapter.disposeSession(this.buildCtx(sessionId));
		this.touch(s, { status: "closed" });
		this.sessions.delete(sessionId);
		this.emit({
			type: "session.removed",
			sessionId
		});
	}
	/**
	* Seed a demo session so the product is immediately playable.
	* Idempotent.
	*/
	async ensureDemoSession() {
		if (this.seeded) return;
		this.seeded = true;
		if (this.sessions.size > 0) return;
		await this.createSession({
			providerId: "grok-build",
			title: "Demo · Grok Build",
			demo: true
		});
	}
};
function defaultTitle(providerId) {
	return {
		"grok-build": "Grok Build session",
		"claude-code": "Claude Code session",
		gemini: "Gemini session",
		gpt: "GPT session",
		simulated: "Simulated session"
	}[providerId] || "Agent session";
}
/** Process-wide singleton */
var globalForHub = globalThis;
function getHub() {
	if (!globalForHub.__sendellHub) globalForHub.__sendellHub = new Hub();
	return globalForHub.__sendellHub;
}
//#endregion
export { getHub };
