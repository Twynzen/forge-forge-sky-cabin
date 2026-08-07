import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { t as Button } from "./button-Bj5saVZy.mjs";
import { h as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { C as ArrowLeft, b as Boxes, m as Layers, n as Workflow, u as Radio, v as Cable } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/docs-DrKxSO50.js
var import_jsx_runtime = require_jsx_runtime();
function DocsPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh bg-bg text-fg",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
			className: "safe-pt sticky top-0 z-10 border-b border-border bg-bg/90 backdrop-blur-md",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mx-auto flex max-w-3xl items-center gap-3 px-4 py-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					variant: "ghost",
					size: "icon-sm",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "size-4" })
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm font-semibold tracking-tight",
					children: "Architecture"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[11px] text-fg-subtle",
					children: "Sendell Remote Control"
				})] })]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
			className: "mx-auto max-w-3xl space-y-10 px-4 py-8 pb-20",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "space-y-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Radio, { className: "size-3.5" }), "Flagship · Sendell.co"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "font-display text-3xl font-semibold tracking-tight text-balance",
							children: "Multi-provider remote control for AI agents"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-fg-muted leading-relaxed",
							children: "Sendell Remote Control is a mobile-first PWA hub that lets you direct coding agents (Grok Build first, then Claude Code, Gemini, GPT…) from your phone. Sessions stream in real time; tool calls wait for your approval."
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					icon: Layers,
					title: "Architecture",
					body: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-fg-muted leading-relaxed",
						children: "Clean three-layer design:"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
						className: "mt-3 overflow-x-auto rounded-xl border border-border bg-bg-elevated p-4 font-mono text-xs text-fg-muted leading-relaxed",
						children: `┌─────────────────────┐
│  PWA Frontend       │  React · Zustand · mobile-first
│  (chat, permissions)│
└──────────┬──────────┘
           │ server functions + poll
┌──────────▼──────────┐
│  Sendell Hub        │  session manager · event bus
└──────────┬──────────┘
           │ ProviderAdapter interface
┌──────────▼──────────┐
│  Adapters           │
│  · Grok Build (ACP) │  stdio or simulated
│  · Claude (stub)    │
│  · Gemini (stub)    │
│  · GPT (stub)       │
└─────────────────────┘`
					})] })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					icon: Cable,
					title: "Agent Client Protocol (ACP)",
					body: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
						className: "list-disc space-y-2 pl-5 text-fg-muted leading-relaxed",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "JSON-RPC 2.0 over stdio (local/VPS) or in-memory transport (demo)" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
									className: "text-primary",
									children: "initialize"
								}),
								" →",
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
									className: "text-primary",
									children: "session/new"
								}),
								" →",
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
									className: "text-primary",
									children: "session/prompt"
								})
							] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
								"Streaming via",
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
									className: "text-primary",
									children: "session/update"
								}),
								" ",
								"(thoughts, messages, tool calls, plan)"
							] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
								"Gated tools via",
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
									className: "text-primary",
									children: "session/request_permission"
								})
							] })
						]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					icon: Boxes,
					title: "Adding a provider",
					body: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
						className: "list-decimal space-y-2 pl-5 text-fg-muted leading-relaxed",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
								"Implement ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
									className: "text-primary",
									children: "ProviderAdapter"
								}),
								" ",
								"in ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
									className: "text-primary",
									children: "src/lib/hub/adapters/"
								})
							] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
								"Prefer reusing ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
									className: "text-primary",
									children: "AcpClient"
								}),
								" ",
								"if the agent speaks ACP"
							] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
								"Register in",
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
									className: "text-primary",
									children: "adapters/registry.ts"
								})
							] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "UI picks it up via listProviders automatically" })
						]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					icon: Workflow,
					title: "Local / VPS with real Grok Build",
					body: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-2 text-fg-muted leading-relaxed",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Set env to talk to a real agent process:" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
								className: "overflow-x-auto rounded-xl border border-border bg-bg-elevated p-4 font-mono text-xs",
								children: `export XAI_API_KEY=...
export SENDELL_GROK_ACP_CMD=grok
export SENDELL_GROK_ACP_ARGS=acp
# createSession with demo: false`
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
								"The adapter spawns the process and speaks ACP over stdio. Full details in",
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
									className: "text-primary",
									children: "docs/ARCHITECTURE.md"
								}),
								"."
							] })
						]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "rounded-2xl border border-border bg-bg-elevated p-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-lg font-semibold tracking-tight",
						children: "Roadmap"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
						className: "mt-3 space-y-2 text-sm text-fg-muted",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "· Claude Code ACP adapter" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "· Gemini CLI adapter" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "· GPT / Codex CLI adapter" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "· WebSocket/SSE push (replace poll)" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "· Multi-user auth + shared workspaces" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "· Session persistence & replay" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "· Bridge real filesystem/terminal to the operator device" })
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					className: "w-full sm:w-auto",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/",
						children: "Back to control panel"
					})
				})
			]
		})]
	});
}
function Section({ icon: Icon, title, body }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "space-y-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex size-8 items-center justify-center rounded-lg bg-bg-subtle text-primary",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-4" })
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-lg font-semibold tracking-tight",
				children: title
			})]
		}), body]
	});
}
//#endregion
export { DocsPage as component };
