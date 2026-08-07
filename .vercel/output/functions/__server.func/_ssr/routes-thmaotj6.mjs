import { r as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { a as DialogOverlay$1, i as DialogDescription$1, n as DialogClose, o as DialogPortal$1, r as DialogContent$1, s as DialogTitle$1, t as Dialog$1 } from "../_libs/@radix-ui/react-dialog+[...].mjs";
import { t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { n as cn, t as Button } from "./button-Bj5saVZy.mjs";
import { h as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { S as BookOpen, _ as Check, a as Terminal, c as ShieldAlert, d as Plus, f as Menu, g as FilePen, h as FileSearch, i as Trash2, l as SendHorizontal, o as Square, p as LoaderCircle, r as User, s as Sparkles, t as X, u as Radio, x as Bot, y as Brain } from "../_libs/lucide-react.mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as create } from "../_libs/zustand.mjs";
import { a as Viewport, i as ScrollAreaThumb, n as Root, r as ScrollAreaScrollbar, t as Corner } from "../_libs/radix-ui__react-scroll-area.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-thmaotj6.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
/**
* Server functions — Frontend boundary for the Hub.
* Hub is always loaded via dynamic import so Node-only code
* never enters the client bundle.
*/
var listProvidersFn = createServerFn({ method: "GET" }).handler(createSsrRpc("3e0f5a919f4463cf4d1583535c35325786dfc9dc4c4ddf96c8fba81ec0a618e7"));
var listSessionsFn = createServerFn({ method: "GET" }).handler(createSsrRpc("14e31574dd662efbb822104bb48565eb312a5799b70b385a825c7a236b3cdbb7"));
var getSessionFn = createServerFn({ method: "GET" }).validator((data) => data).handler(createSsrRpc("98650673cb4c496645c9112d91fe69903fd1eb2dbce2d71f2fa1d9cbc35db515"));
var createSessionFn = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("2176660bad82bca0c7bdc9ce94b86ce5543e62e083e1eb87049faa322dc6bbe0"));
createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("1c05c3563cfeaea968b7f4475cc3a9984c47acb168e8345fae60367ce3fd5693"));
var resolvePermissionFn = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("1791d18087afc435b851ab81bc387b55c266695f8c46aeb41182ddc0081fa300"));
var cancelSessionFn = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("8bdc05409505885c06bbec94cbba35f24b9f215a80088192063f9aebecddd1b6"));
var closeSessionFn = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("6ac12d337ce0ce9e484352b2e9983249c6769843652b99e37ef411582379e73c"));
/** Non-blocking prompt start — returns immediately while agent streams */
var startPromptFn = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("a2435fc84607c30c5e0ce622fb11b1bee05c764e7ea54cb2afabcf578c6867d1"));
/**
* Client-side app store (zustand).
* Mirrors hub state for snappy UI; syncs via polling + optimistic updates.
*/
var useAppStore = create((set) => ({
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
	setSnapshot: (snap) => set((state) => ({
		snapshots: {
			...state.snapshots,
			[snap.id]: snap
		},
		sessions: state.sessions.some((s) => s.id === snap.id) ? state.sessions.map((s) => s.id === snap.id ? {
			id: snap.id,
			title: snap.title,
			providerId: snap.providerId,
			status: snap.status,
			cwd: snap.cwd,
			model: snap.model,
			createdAt: snap.createdAt,
			updatedAt: snap.updatedAt,
			lastError: snap.lastError,
			remoteSessionId: snap.remoteSessionId,
			demo: snap.demo
		} : s) : [{
			id: snap.id,
			title: snap.title,
			providerId: snap.providerId,
			status: snap.status,
			cwd: snap.cwd,
			model: snap.model,
			createdAt: snap.createdAt,
			updatedAt: snap.updatedAt,
			lastError: snap.lastError,
			remoteSessionId: snap.remoteSessionId,
			demo: snap.demo
		}, ...state.sessions]
	})),
	patchSession: (id, patch) => set((state) => ({
		sessions: state.sessions.map((s) => s.id === id ? {
			...s,
			...patch
		} : s),
		snapshots: state.snapshots[id] ? {
			...state.snapshots,
			[id]: {
				...state.snapshots[id],
				...patch
			}
		} : state.snapshots
	})),
	appendMessage: (sessionId, message) => set((state) => {
		const snap = state.snapshots[sessionId];
		if (!snap) return state;
		if (snap.messages.some((m) => m.id === message.id)) return state;
		return { snapshots: {
			...state.snapshots,
			[sessionId]: {
				...snap,
				messages: [...snap.messages, message]
			}
		} };
	}),
	updateMessage: (sessionId, message) => set((state) => {
		const snap = state.snapshots[sessionId];
		if (!snap) return state;
		return { snapshots: {
			...state.snapshots,
			[sessionId]: {
				...snap,
				messages: snap.messages.map((m) => m.id === message.id ? message : m)
			}
		} };
	}),
	applyChunk: (sessionId, messageId, chunk) => set((state) => {
		const snap = state.snapshots[sessionId];
		if (!snap) return state;
		return { snapshots: {
			...state.snapshots,
			[sessionId]: {
				...snap,
				messages: snap.messages.map((m) => {
					if (m.id !== messageId) return m;
					const content = m.content.map((c) => c.type === "text" ? {
						...c,
						text: c.text + chunk
					} : c);
					const hasText = content.some((c) => c.type === "text");
					return {
						...m,
						streaming: true,
						content: hasText ? content : [...content, {
							type: "text",
							text: chunk
						}]
					};
				})
			}
		} };
	}),
	setPlan: (sessionId, steps) => set((state) => {
		const snap = state.snapshots[sessionId];
		if (!snap) return state;
		return { snapshots: {
			...state.snapshots,
			[sessionId]: {
				...snap,
				plan: steps
			}
		} };
	}),
	setPendingPermission: (sessionId, tool) => set((state) => {
		const snap = state.snapshots[sessionId];
		if (!snap) return state;
		return { snapshots: {
			...state.snapshots,
			[sessionId]: {
				...snap,
				pendingPermissions: tool ? [tool] : []
			}
		} };
	}),
	setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
	setSending: (sending) => set({ sending }),
	setBootstrapped: (bootstrapped) => set({ bootstrapped }),
	removeSession: (id) => set((state) => {
		const { [id]: _, ...rest } = state.snapshots;
		const sessions = state.sessions.filter((s) => s.id !== id);
		return {
			snapshots: rest,
			sessions,
			activeSessionId: state.activeSessionId === id ? sessions[0]?.id ?? null : state.activeSessionId
		};
	})
}));
var Textarea = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
	className: cn("flex min-h-[44px] w-full resize-none rounded-xl border border-border bg-bg-elevated px-3.5 py-3 text-sm text-fg placeholder:text-fg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50", className),
	ref,
	...props
}));
Textarea.displayName = "Textarea";
var SUGGESTIONS = [
	"Explain the hub architecture",
	"Implement a session export feature",
	"List open questions for Claude adapter"
];
function Composer({ disabled, sending, onSend, onCancel, placeholder }) {
	const [text, setText] = (0, import_react.useState)("");
	const ref = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const el = ref.current;
		if (!el) return;
		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
	}, [text]);
	const submit = () => {
		const t = text.trim();
		if (!t || disabled || sending) return;
		onSend(t);
		setText("");
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "safe-pb border-t border-border bg-bg/90 backdrop-blur-md",
		children: [!text && !sending && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex gap-2 overflow-x-auto px-3 pt-2.5 scrollbar-none sm:px-4",
			children: SUGGESTIONS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => setText(s),
				className: "shrink-0 rounded-full border border-border bg-bg-subtle px-3 py-1.5 text-xs text-fg-muted transition hover:border-border-strong hover:text-fg",
				children: s
			}, s))
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-end gap-2 p-3 sm:px-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
				ref,
				value: text,
				onChange: (e) => setText(e.target.value),
				placeholder: placeholder ?? "Message agent…",
				disabled,
				rows: 1,
				className: cn("max-h-40 min-h-11 flex-1 bg-bg-elevated", disabled && "opacity-60"),
				onKeyDown: (e) => {
					if (e.key === "Enter" && !e.shiftKey) {
						e.preventDefault();
						submit();
					}
				}
			}), sending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				type: "button",
				size: "icon",
				variant: "secondary",
				className: "shrink-0",
				onClick: onCancel,
				"aria-label": "Stop",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Square, { className: "size-4 fill-current" })
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				type: "button",
				size: "icon",
				className: "shrink-0",
				disabled: disabled || !text.trim(),
				onClick: submit,
				"aria-label": "Send",
				children: sending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SendHorizontal, { className: "size-4" })
			})]
		})]
	});
}
function kindIcon(kind) {
	switch (kind) {
		case "read":
		case "search": return FileSearch;
		case "edit":
		case "delete":
		case "move": return FilePen;
		case "execute": return Terminal;
		default: return ShieldAlert;
	}
}
function ToolCallCard({ tool, onAllow, onReject, compact }) {
	const Icon = kindIcon(tool.kind);
	const needsAction = tool.status === "awaiting_permission";
	const running = tool.status === "running" || tool.status === "pending";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("rounded-xl border bg-bg-subtle/80 overflow-hidden", needsAction ? "border-warning/40 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-warning)_15%,transparent)]" : "border-border", compact ? "text-xs" : "text-sm"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start gap-3 p-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border", needsAction ? "border-warning/30 bg-warning/10 text-warning" : tool.status === "completed" ? "border-success/30 bg-success/10 text-success" : tool.status === "rejected" || tool.status === "failed" ? "border-danger/30 bg-danger/10 text-danger" : "border-border bg-bg-muted text-fg-muted"),
				children: running && tool.status !== "awaiting_permission" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }) : tool.status === "completed" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-4" }) : tool.status === "rejected" || tool.status === "failed" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-4" })
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-medium text-fg truncate",
							children: tool.title
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[10px] uppercase tracking-wider text-fg-subtle",
							children: tool.kind
						})]
					}),
					tool.input && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
						className: "mt-1.5 max-h-24 overflow-auto rounded-md bg-bg/60 p-2 font-mono text-[11px] text-fg-muted leading-relaxed",
						children: JSON.stringify(tool.input, null, 2)
					}),
					tool.output && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
						className: "mt-1.5 max-h-32 overflow-auto rounded-md border border-border bg-bg p-2 font-mono text-[11px] text-fg-muted leading-relaxed",
						children: tool.output
					})
				]
			})]
		}), needsAction && onAllow && onReject && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex gap-2 border-t border-warning/20 bg-warning/5 p-2.5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				size: "sm",
				className: "flex-1 min-h-11",
				onClick: onAllow,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3.5" }), "Allow"]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				size: "sm",
				variant: "danger",
				className: "flex-1 min-h-11",
				onClick: onReject,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" }), "Reject"]
			})]
		})]
	});
}
function renderMarkdownLite(text) {
	return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
		if (part.startsWith("**") && part.endsWith("**")) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
			className: "font-semibold text-fg",
			children: part.slice(2, -2)
		}, i);
		if (part.startsWith("`") && part.endsWith("`")) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
			className: "rounded bg-bg-muted px-1 py-0.5 font-mono text-[0.85em] text-primary",
			children: part.slice(1, -1)
		}, i);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: part }, i);
	});
}
function PlanBlock({ steps }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-border bg-bg-subtle/60 p-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mb-2 text-[11px] font-medium uppercase tracking-wider text-fg-subtle",
			children: "Plan"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
			className: "space-y-1.5",
			children: steps.map((s, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex items-start gap-2 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("mt-1 size-1.5 shrink-0 rounded-full", s.status === "completed" && "bg-success", s.status === "in_progress" && "bg-primary animate-pulse-dot", s.status === "failed" && "bg-danger", s.status === "pending" && "bg-fg-subtle") }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: cn("text-fg-muted", s.status === "completed" && "text-fg-subtle line-through", s.status === "in_progress" && "text-fg"),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mr-1.5 font-mono text-[10px] text-fg-subtle",
						children: String(i + 1).padStart(2, "0")
					}), s.title]
				})]
			}, s.id))
		})]
	});
}
function ContentBlocks({ blocks, onAllow, onReject }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "space-y-2.5",
		children: blocks.map((b, i) => {
			if (b.type === "text") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "whitespace-pre-wrap break-words text-[15px] leading-relaxed text-fg/95",
				children: renderMarkdownLite(b.text)
			}, i);
			if (b.type === "code") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
				className: "overflow-x-auto rounded-lg border border-border bg-bg p-3 font-mono text-xs text-fg-muted",
				children: b.code
			}, i);
			if (b.type === "tool_call") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToolCallCard, {
				tool: b.toolCall,
				onAllow: b.toolCall.status === "awaiting_permission" && onAllow ? () => onAllow(b.toolCall) : void 0,
				onReject: b.toolCall.status === "awaiting_permission" && onReject ? () => onReject(b.toolCall) : void 0
			}, i);
			if (b.type === "plan") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlanBlock, { steps: b.steps }, i);
			return null;
		})
	});
}
function MessageList({ messages, onAllow, onReject }) {
	const endRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		endRef.current?.scrollIntoView({
			behavior: "smooth",
			block: "end"
		});
	}, [messages.length, messages[messages.length - 1]?.content]);
	if (messages.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full flex-col items-center justify-center gap-3 px-6 text-center",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex size-14 items-center justify-center rounded-2xl border border-border bg-bg-subtle",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bot, { className: "size-6 text-primary" })
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "font-display text-lg font-medium tracking-tight text-fg",
			children: "Ready to control"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 max-w-xs text-sm text-fg-muted leading-relaxed",
			children: "Send a prompt to your agent. Tool calls will pause for your approval on this device."
		})] })]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex w-full max-w-3xl flex-col gap-4 px-3 py-4 sm:px-5",
		children: [messages.map((m) => {
			if (m.role === "system") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mx-auto max-w-md rounded-xl border border-border/80 bg-bg-subtle/50 px-3.5 py-2.5 text-center text-xs text-fg-muted leading-relaxed animate-fade-up",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContentBlocks, { blocks: m.content })
			}, m.id);
			if (m.role === "thought") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex gap-2.5 animate-fade-up opacity-90",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg bg-thought/10 text-thought",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Brain, { className: "size-3.5" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0 flex-1 rounded-xl border border-thought/15 bg-thought/5 px-3 py-2 text-sm text-thought/90 italic",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContentBlocks, { blocks: m.content }), m.streaming && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "ml-1 inline-block size-1.5 rounded-full bg-thought animate-pulse-dot" })]
				})]
			}, m.id);
			const isUser = m.role === "user";
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: cn("flex gap-2.5 animate-fade-up", isUser && "flex-row-reverse"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: cn("mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg", isUser ? "bg-primary/15 text-primary" : "bg-bg-muted text-fg-muted"),
					children: isUser ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(User, { className: "size-3.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bot, { className: "size-3.5" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: cn("min-w-0 max-w-[min(100%,36rem)] rounded-2xl px-3.5 py-2.5", isUser ? "rounded-tr-md bg-primary text-primary-fg" : "rounded-tl-md border border-border bg-card"),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: cn(isUser && "[&_strong]:text-primary-fg [&_code]:bg-primary-fg/15 [&_code]:text-primary-fg"),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContentBlocks, {
							blocks: m.content,
							onAllow,
							onReject
						})
					}), m.streaming && !isUser && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mt-1 inline-block size-1.5 rounded-full bg-primary animate-pulse-dot" })]
				})]
			}, m.id);
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref: endRef,
			className: "h-px"
		})]
	});
}
var badgeVariants = cva("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide", {
	variants: { variant: {
		default: "border-border bg-bg-subtle text-fg-muted",
		primary: "border-primary/30 bg-primary/10 text-primary",
		success: "border-success/25 bg-success/10 text-success",
		warning: "border-warning/25 bg-warning/10 text-warning",
		danger: "border-danger/25 bg-danger/10 text-danger",
		info: "border-info/25 bg-info/10 text-info"
	} },
	defaultVariants: { variant: "default" }
});
function Badge({ className, variant, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn(badgeVariants({ variant }), className),
		...props
	});
}
var labels = {
	"grok-build": "Grok Build",
	"claude-code": "Claude Code",
	gemini: "Gemini",
	gpt: "GPT",
	simulated: "Simulated"
};
function ProviderBadge({ providerId, demo, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
		variant: providerId === "grok-build" ? "primary" : "default",
		className: cn("font-mono uppercase tracking-wider", className),
		children: [labels[providerId] ?? providerId, demo ? " · demo" : ""]
	});
}
var statusColor = {
	idle: "bg-fg-subtle",
	connecting: "bg-warning",
	ready: "bg-success",
	thinking: "bg-thought",
	streaming: "bg-primary",
	awaiting_permission: "bg-warning",
	error: "bg-danger",
	closed: "bg-fg-subtle"
};
function StatusDot({ status, className, pulse }) {
	const shouldPulse = pulse ?? (status === "thinking" || status === "streaming" || status === "connecting" || status === "awaiting_permission");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("inline-block size-2 shrink-0 rounded-full", statusColor[status], shouldPulse && "animate-pulse-dot", className),
		"aria-hidden": true
	});
}
function statusLabel(status) {
	return {
		idle: "Idle",
		connecting: "Connecting",
		ready: "Ready",
		thinking: "Thinking",
		streaming: "Streaming",
		awaiting_permission: "Needs approval",
		error: "Error",
		closed: "Closed"
	}[status];
}
function ChatPanel({ snapshot, sending, onMenu, onSend, onCancel, onAllow, onReject }) {
	if (!snapshot) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full flex-col items-center justify-center gap-3 bg-bg px-6 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex size-16 items-center justify-center rounded-2xl border border-border bg-bg-elevated",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Radio, { className: "size-7 text-primary" })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-xl font-semibold tracking-tight text-fg",
				children: "Sendell Remote Control"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 max-w-sm text-sm text-fg-muted leading-relaxed",
				children: "Select or create a session to direct AI agents from your phone."
			})] }),
			onMenu && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				onClick: onMenu,
				className: "mt-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Menu, { className: "size-4" }), "Open sessions"]
			})
		]
	});
	const pending = snapshot.pendingPermissions[0];
	const busy = sending || snapshot.status === "thinking" || snapshot.status === "streaming" || snapshot.status === "awaiting_permission";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full min-h-0 flex-col bg-bg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "safe-pt flex items-center gap-2 border-b border-border bg-bg-elevated/90 px-2 py-2 backdrop-blur-md sm:px-4",
				children: [onMenu && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "icon",
					variant: "ghost",
					className: "lg:hidden",
					onClick: onMenu,
					"aria-label": "Sessions",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Menu, { className: "size-5" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0 flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusDot, { status: snapshot.status }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "truncate font-display text-sm font-semibold tracking-tight text-fg sm:text-base",
							children: snapshot.title
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-0.5 flex flex-wrap items-center gap-1.5 pl-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProviderBadge, {
							providerId: snapshot.providerId,
							demo: snapshot.demo
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-[11px] text-fg-subtle",
							children: [statusLabel(snapshot.status), snapshot.model ? ` · ${snapshot.model}` : ""]
						})]
					})]
				})]
			}),
			pending && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "border-b border-warning/30 bg-warning/10 px-3 py-2.5 sm:px-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-2 text-xs font-medium text-warning",
					children: "Agent requests permission"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToolCallCard, {
					tool: pending,
					onAllow: () => onAllow(pending),
					onReject: () => onReject(pending)
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "min-h-0 flex-1 overflow-y-auto",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageList, {
					messages: snapshot.messages,
					onAllow,
					onReject
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Composer, {
				sending: busy,
				disabled: snapshot.status === "error" || snapshot.status === "closed" || snapshot.status === "connecting",
				onSend,
				onCancel,
				placeholder: snapshot.status === "awaiting_permission" ? "Approve or reject the tool call above…" : "Message agent…"
			})
		]
	});
}
var Dialog = Dialog$1;
var DialogPortal = DialogPortal$1;
function DialogOverlay({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay$1, {
		className: cn("fixed inset-0 z-50 bg-black/65 backdrop-blur-[2px]", className),
		...props
	});
}
function DialogContent({ className, children, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent$1, {
		className: cn("fixed left-1/2 top-1/2 z-50 w-[min(100%-1.5rem,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-bg-elevated p-5 shadow-soft outline-none animate-fade-up", className),
		...props,
		children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogClose, {
			className: "absolute right-3 top-3 rounded-md p-2 text-fg-muted hover:bg-bg-subtle hover:text-fg",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "sr-only",
				children: "Close"
			})]
		})]
	})] });
}
function DialogHeader({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("mb-4 flex flex-col gap-1.5 pr-8", className),
		...props
	});
}
function DialogTitle({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle$1, {
		className: cn("text-lg font-semibold tracking-tight text-fg", className),
		...props
	});
}
function DialogDescription({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription$1, {
		className: cn("text-sm text-fg-muted leading-relaxed", className),
		...props
	});
}
var Input = import_react.forwardRef(({ className, type, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
	type,
	className: cn("flex h-11 w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50", className),
	ref,
	...props
}));
Input.displayName = "Input";
function NewSessionDialog({ open, onOpenChange, providers, onCreate, creating }) {
	const available = providers.filter((p) => p.available);
	const [providerId, setProviderId] = (0, import_react.useState)("grok-build");
	const [title, setTitle] = (0, import_react.useState)("");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "New session" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, { children: "Spin up a remote agent session. Grok Build runs via ACP (demo simulated here; real CLI on local/VPS)." })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
					className: "mb-1.5 block text-xs font-medium text-fg-muted",
					children: "Provider"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-2",
					children: providers.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						disabled: !p.available,
						onClick: () => setProviderId(p.id),
						className: cn("flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition", providerId === p.id && p.available ? "border-primary/40 bg-primary/10" : "border-border bg-bg-subtle", !p.available && "opacity-45 cursor-not-allowed"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex size-9 items-center justify-center rounded-lg bg-bg-muted text-primary",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-4" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-sm font-medium text-fg",
								children: [p.name, !p.available && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ml-2 text-[10px] uppercase tracking-wider text-fg-subtle",
									children: "Soon"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "truncate text-xs text-fg-muted",
								children: p.description
							})]
						})]
					}, p.id))
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
					className: "mb-1.5 block text-xs font-medium text-fg-muted",
					children: "Title (optional)"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: title,
					onChange: (e) => setTitle(e.target.value),
					placeholder: "e.g. Refactor auth module"
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					className: "w-full min-h-11",
					disabled: creating || available.length === 0,
					onClick: () => onCreate({
						providerId,
						title: title.trim() || void 0
					}),
					children: creating ? "Starting…" : "Start session"
				})
			]
		})] })
	});
}
var ScrollArea = import_react.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Root, {
	ref,
	className: cn("relative overflow-hidden", className),
	...props,
	children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Viewport, {
			className: "h-full w-full rounded-[inherit]",
			children
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScrollBar, {}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Corner, {})
	]
}));
ScrollArea.displayName = Root.displayName;
function ScrollBar({ className, orientation = "vertical", ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScrollAreaScrollbar, {
		orientation,
		className: cn("flex touch-none select-none transition-colors", orientation === "vertical" && "h-full w-2 border-l border-l-transparent p-px", orientation === "horizontal" && "h-2 flex-col border-t border-t-transparent p-px", className),
		...props,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScrollAreaThumb, { className: "relative flex-1 rounded-full bg-border-strong" })
	});
}
function SessionSidebar({ sessions, providers, activeId, onSelect, onNew, onClose, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
		className: cn("flex h-full w-full flex-col bg-bg-elevated", className),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "safe-pt flex items-center gap-3 border-b border-border px-4 py-3.5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Radio, { className: "size-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-sm font-semibold tracking-tight text-fg",
							children: "Sendell"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] text-fg-subtle",
							children: "Remote Control"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "icon-sm",
						variant: "secondary",
						onClick: onNew,
						"aria-label": "New session",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" })
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "px-3 pt-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-2 px-1 text-[10px] font-medium uppercase tracking-wider text-fg-subtle",
					children: "Providers"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-wrap gap-1.5",
					children: providers.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: cn("rounded-md border px-2 py-1 text-[10px] font-medium", p.available ? "border-primary/25 bg-primary/10 text-primary" : "border-border bg-bg-subtle text-fg-subtle"),
						title: p.description,
						children: [p.name, !p.available ? " · soon" : ""]
					}, p.id))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex items-center justify-between px-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[10px] font-medium uppercase tracking-wider text-fg-subtle",
					children: "Sessions"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-[10px] text-fg-subtle tabular-nums",
					children: sessions.length
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScrollArea, {
				className: "flex-1 px-2 py-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-1",
					children: [sessions.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "px-3 py-6 text-center text-xs text-fg-subtle",
						children: "No sessions yet"
					}), sessions.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						role: "button",
						tabIndex: 0,
						onClick: () => onSelect(s.id),
						onKeyDown: (e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								onSelect(s.id);
							}
						},
						className: cn("group flex w-full cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition", activeId === s.id ? "bg-bg-muted ring-1 ring-border-strong" : "hover:bg-bg-subtle"),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusDot, {
								status: s.status,
								className: "mt-1.5"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "truncate text-sm font-medium text-fg",
									children: s.title
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-1 flex flex-wrap items-center gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProviderBadge, {
										providerId: s.providerId,
										demo: s.demo
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px] text-fg-subtle",
										children: statusLabel(s.status)
									})]
								})]
							}),
							onClose && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "mt-0.5 rounded-md p-1.5 text-fg-subtle opacity-0 transition hover:bg-bg group-hover:opacity-100 hover:text-danger focus:opacity-100",
								onClick: (e) => {
									e.stopPropagation();
									onClose(s.id);
								},
								"aria-label": "Close session",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
							})
						]
					}, s.id))]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "safe-pb border-t border-border p-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/docs",
					className: "flex items-center gap-2 rounded-lg px-2 py-2 text-xs text-fg-muted transition hover:bg-bg-subtle hover:text-fg",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookOpen, { className: "size-3.5" }), "Architecture & docs"]
				})
			})
		]
	});
}
var Sheet = Dialog$1;
function SheetPortal(props) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogPortal$1, { ...props });
}
function SheetOverlay({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay$1, {
		className: cn("fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className),
		...props
	});
}
function SheetContent({ className, children, side = "left", showClose = true, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetOverlay, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent$1, {
		className: cn("fixed z-50 flex flex-col gap-0 bg-bg-elevated shadow-soft border-border outline-none", side === "left" && "inset-y-0 left-0 h-full w-[min(100%,20rem)] border-r data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left", side === "right" && "inset-y-0 right-0 h-full w-[min(100%,20rem)] border-l data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right", side === "bottom" && "inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl border-t data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom", className),
		...props,
		children: [children, showClose && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogClose, {
			className: "absolute right-3 top-3 z-10 rounded-md p-2 text-fg-muted hover:bg-bg-subtle hover:text-fg",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "sr-only",
				children: "Close"
			})]
		})]
	})] });
}
function SheetHeader({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("flex flex-col gap-1.5 p-4 pr-12 border-b border-border", className),
		...props
	});
}
function SheetTitle({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle$1, {
		className: cn("text-base font-semibold tracking-tight text-fg", className),
		...props
	});
}
var POLL_MS = 450;
function AppShell() {
	const { providers, sessions, activeSessionId, snapshots, sidebarOpen, sending, bootstrapped, setProviders, setSessions, setActiveSessionId, setSnapshot, setSidebarOpen, setSending, setBootstrapped, removeSession } = useAppStore();
	const [newOpen, setNewOpen] = (0, import_react.useState)(false);
	const [creating, setCreating] = (0, import_react.useState)(false);
	const refreshSessions = (0, import_react.useCallback)(async () => {
		const list = await listSessionsFn();
		setSessions(list);
		return list;
	}, [setSessions]);
	const refreshSnapshot = (0, import_react.useCallback)(async (id) => {
		try {
			const snap = await getSessionFn({ data: { sessionId: id } });
			setSnapshot(snap);
			return snap;
		} catch {
			return null;
		}
	}, [setSnapshot]);
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		(async () => {
			try {
				const [prov, list] = await Promise.all([listProvidersFn(), listSessionsFn()]);
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
		setSessions
	]);
	(0, import_react.useEffect)(() => {
		if (!activeSessionId) return;
		const snap = snapshots[activeSessionId];
		if (!(sending || !snap || snap.status === "thinking" || snap.status === "streaming" || snap.status === "awaiting_permission" || snap.status === "connecting")) return;
		const t = window.setInterval(() => {
			refreshSnapshot(activeSessionId);
			refreshSessions();
		}, POLL_MS);
		return () => window.clearInterval(t);
	}, [
		activeSessionId,
		refreshSessions,
		refreshSnapshot,
		sending,
		snapshots
	]);
	const selectSession = async (id) => {
		setActiveSessionId(id);
		setSidebarOpen(false);
		await refreshSnapshot(id);
	};
	const handleCreate = async (input) => {
		setCreating(true);
		try {
			const snap = await createSessionFn({ data: {
				providerId: input.providerId,
				title: input.title,
				demo: true
			} });
			setSnapshot(snap);
			await refreshSessions();
			setActiveSessionId(snap.id);
			setNewOpen(false);
			setSidebarOpen(false);
			toast.success("Session started");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Could not create session");
		} finally {
			setCreating(false);
		}
	};
	const handleSend = async (text) => {
		if (!activeSessionId) return;
		setSending(true);
		try {
			await startPromptFn({ data: {
				sessionId: activeSessionId,
				text
			} });
			await refreshSnapshot(activeSessionId);
			const pollUntilDone = async () => {
				for (let i = 0; i < 120; i++) {
					await new Promise((r) => setTimeout(r, POLL_MS));
					const snap = await refreshSnapshot(activeSessionId);
					if (!snap || snap.status === "ready" || snap.status === "error" || snap.status === "closed") break;
				}
				setSending(false);
				await refreshSessions();
			};
			pollUntilDone();
		} catch (err) {
			setSending(false);
			toast.error(err instanceof Error ? err.message : "Send failed");
		}
	};
	const handlePermission = async (tool, decision) => {
		if (!activeSessionId) return;
		try {
			await resolvePermissionFn({ data: {
				sessionId: activeSessionId,
				toolCallId: tool.id,
				decision
			} });
			await refreshSnapshot(activeSessionId);
			if (decision === "allow") {
				setSending(true);
				for (let i = 0; i < 80; i++) {
					await new Promise((r) => setTimeout(r, POLL_MS));
					const snap = await refreshSnapshot(activeSessionId);
					if (!snap || snap.status === "ready" || snap.status === "error" || snap.status === "awaiting_permission") break;
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
	const handleClose = async (id) => {
		await closeSessionFn({ data: { sessionId: id } });
		removeSession(id);
		await refreshSessions();
	};
	const activeSnap = activeSessionId ? snapshots[activeSessionId] ?? null : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-dvh w-full overflow-hidden bg-bg text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "hidden w-72 shrink-0 border-r border-border lg:block xl:w-80",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SessionSidebar, {
					sessions,
					providers,
					activeId: activeSessionId,
					onSelect: (id) => void selectSession(id),
					onNew: () => setNewOpen(true),
					onClose: (id) => void handleClose(id)
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
				open: sidebarOpen,
				onOpenChange: setSidebarOpen,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetContent, {
					side: "left",
					className: "w-[min(100%,20rem)] p-0",
					showClose: false,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetHeader, {
						className: "sr-only",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, { children: "Sessions" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SessionSidebar, {
						sessions,
						providers,
						activeId: activeSessionId,
						onSelect: (id) => void selectSession(id),
						onNew: () => {
							setSidebarOpen(false);
							setNewOpen(true);
						},
						onClose: (id) => void handleClose(id)
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
				className: "min-w-0 flex-1",
				children: !bootstrapped ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex h-full items-center justify-center",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "shimmer text-sm font-medium",
						children: "Connecting to hub…"
					})
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChatPanel, {
					snapshot: activeSnap,
					sending,
					onMenu: () => setSidebarOpen(true),
					onSend: (t) => void handleSend(t),
					onCancel: () => void handleCancel(),
					onAllow: (tool) => void handlePermission(tool, "allow"),
					onReject: (tool) => void handlePermission(tool, "reject")
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NewSessionDialog, {
				open: newOpen,
				onOpenChange: setNewOpen,
				providers,
				creating,
				onCreate: (input) => void handleCreate(input)
			})
		]
	});
}
function HomePage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {});
}
//#endregion
export { HomePage as component };
