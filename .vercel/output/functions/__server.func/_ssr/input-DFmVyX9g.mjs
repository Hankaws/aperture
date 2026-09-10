import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { n as cn } from "./utils-DTfuEt1f.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/input-DFmVyX9g.js
var import_jsx_runtime = require_jsx_runtime();
function Input({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		className: cn("h-10 w-full rounded-lg border border-border bg-elevated px-3 text-sm text-fg placeholder:text-subtle", "transition-[box-shadow,border-color] duration-150 ease-out", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50", className),
		...props
	});
}
//#endregion
export { Input as t };
