import { r as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { p as Slot } from "../_libs/@radix-ui/react-dialog+[...].mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/button-Bj5saVZy.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0", {
	variants: {
		variant: {
			default: "bg-primary text-primary-fg shadow-sm hover:brightness-110",
			secondary: "bg-bg-subtle text-fg border border-border hover:bg-bg-muted hover:border-border-strong",
			ghost: "text-fg-muted hover:bg-bg-subtle hover:text-fg",
			danger: "bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25",
			outline: "border border-border bg-transparent text-fg hover:bg-bg-subtle"
		},
		size: {
			default: "h-10 px-4 py-2 min-h-11",
			sm: "h-8 rounded-md px-3 text-xs min-h-9",
			lg: "h-12 rounded-xl px-6 text-base min-h-12",
			icon: "h-10 w-10 min-h-11 min-w-11",
			"icon-sm": "h-8 w-8 min-h-9 min-w-9"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
var Button = import_react.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size,
			className
		})),
		ref,
		...props
	});
});
Button.displayName = "Button";
//#endregion
export { cn as n, Button as t };
