import { o as __toESM } from "../_runtime.mjs";
import { n as PROVIDERS } from "./plans-CTIRB29R.mjs";
import { r as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { n as cn } from "./utils-DTfuEt1f.mjs";
import { a as buttonVariants, o as useCurrentUserState } from "./auth-slot-TCLjKAfg.mjs";
import { D as KeyRound, G as Check, H as Circle, T as Layers, Y as ArrowRight, c as Sparkles, l as ShieldCheck } from "../_libs/lucide-react.mjs";
import { t as SiteNav } from "./site-nav-BSNhfuul.mjs";
import { n as SiteFooter, t as PricingTable } from "./pricing-table-Bteo47lM.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-BgEXUgJ1.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function usePrefersReducedMotion() {
	const [reduced, setReduced] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
		setReduced(mq.matches);
		const onChange = () => setReduced(mq.matches);
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, []);
	return reduced;
}
function Reveal({ children, className, delay = 0 }) {
	const ref = (0, import_react.useRef)(null);
	const [on, setOn] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		const el = ref.current;
		if (!el) return;
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			setOn(true);
			return;
		}
		const io = new IntersectionObserver(([entry]) => {
			if (entry?.isIntersecting) {
				setOn(true);
				io.disconnect();
			}
		}, {
			threshold: .18,
			rootMargin: "0px 0px -8% 0px"
		});
		io.observe(el);
		return () => io.disconnect();
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		ref,
		className: cn("reveal", on && "is-in", className),
		style: { animationDelay: `${delay}ms` },
		children
	});
}
function useTyped(text, active, reduced, speed = 18) {
	const [n, setN] = (0, import_react.useState)(reduced || !active ? reduced ? text.length : 0 : 0);
	(0, import_react.useEffect)(() => {
		if (reduced) {
			setN(text.length);
			return;
		}
		if (!active) {
			setN(0);
			return;
		}
		setN(0);
		const id = window.setInterval(() => {
			setN((v) => {
				if (v >= text.length) {
					window.clearInterval(id);
					return v;
				}
				return v + 1;
			});
		}, speed);
		return () => window.clearInterval(id);
	}, [
		text,
		active,
		reduced,
		speed
	]);
	return {
		text: text.slice(0, n),
		done: n >= text.length,
		n
	};
}
var PROMPT = "Fix pagination in @src/store.ts";
var ADD_LINE = "    return tasks.slice(start, start + pageSize);";
var GUARD_LINE = "    if (!task) throw new NotFound(id);";
var STEPS_MS = 900;
function useDemoClock(reduced) {
	const [phase, setPhase] = (0, import_react.useState)(reduced ? 6 : 0);
	(0, import_react.useEffect)(() => {
		if (reduced) {
			setPhase(6);
			return;
		}
		const id = window.setInterval(() => {
			setPhase((p) => (p + 1) % 7);
		}, STEPS_MS);
		return () => window.clearInterval(id);
	}, [reduced]);
	return phase;
}
function PlanRow({ n, label, state }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2",
		children: [state === "done" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {
			className: cn("size-3 text-ok", "plan-tick is-on"),
			strokeWidth: 2.4
		}) : state === "run" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Circle, {
			className: "size-3 animate-pulse text-accent",
			strokeWidth: 2
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Circle, {
			className: "size-3 text-subtle",
			strokeWidth: 1.6
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: cn("text-xs", state === "done" && "text-ok", state === "run" && "text-fg", state === "wait" && "text-subtle"),
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-[0.7rem] text-subtle",
					children: n
				}),
				" ",
				label
			]
		})]
	});
}
function ProductDemo() {
	const reduced = usePrefersReducedMotion();
	const phase = useDemoClock(reduced);
	const typed = useTyped(PROMPT, phase >= 1, reduced, 26);
	const typedAdd = useTyped(ADD_LINE, phase >= 4, reduced, 14);
	const typedGuard = useTyped(GUARD_LINE, phase >= 5, reduced, 14);
	const showCost = phase >= 2;
	const plan1 = phase >= 4 ? "done" : phase >= 3 ? "run" : "wait";
	const plan2 = phase >= 5 ? "done" : phase >= 4 ? "run" : "wait";
	const plan3 = phase >= 6 ? "done" : phase >= 5 ? "run" : "wait";
	const showAdd = phase >= 4;
	const showDel = phase >= 5;
	const staged = phase >= 6;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-float)]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex h-10 items-center gap-2 border-b border-border px-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2 rounded-full bg-border" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2 rounded-full bg-border" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2 rounded-full bg-border" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "ml-2 truncate font-mono text-xs text-subtle",
					children: "harbor-api / src/store.ts"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: cn("ml-auto hidden font-mono text-xs sm:inline", staged ? "text-ok" : "text-subtle"),
					children: staged ? "staged · 1 file" : phase >= 3 ? "Composer running" : "indexed · 34 chunks"
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid min-h-72 md:grid-cols-[9.5rem_1fr_15rem]",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
					className: "hidden border-r border-border p-3 font-mono text-xs text-muted md:block",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mb-2 font-sans text-[0.65rem] tracking-[0.14em] text-subtle uppercase",
							children: "Workspace"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-fg",
							children: ".aperture.md"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "src" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: cn("pl-3", phase >= 3 ? "text-accent" : "text-fg"),
							children: "store.ts"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "pl-3",
							children: "tasks.ts"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "pl-3",
							children: "validate.ts"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3",
							children: "package.json"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("pre", {
					className: "overflow-hidden p-4 font-mono text-xs leading-6 text-muted",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-subtle",
							children: "24"
						}),
						"  ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-accent",
							children: "export function"
						}),
						" listTasks() ",
						"{",
						"\n",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-subtle",
							children: "25"
						}),
						"    const start = page * pageSize;",
						"\n",
						showAdd ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "bg-ok/10 text-ok",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-subtle",
									children: "26"
								}),
								typedAdd.text,
								!typedAdd.done ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "caret-blink" }) : null
							]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-muted",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-subtle",
								children: "26"
							}), "    return tasks;"]
						}),
						"\n",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-subtle",
							children: "27"
						}),
						"  ",
						"}",
						"\n",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-subtle",
							children: "28"
						}),
						"\n",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-subtle",
							children: "29"
						}),
						"  ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-accent",
							children: "export function"
						}),
						" getTask(id: ID) ",
						"{",
						"\n",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-subtle",
							children: "30"
						}),
						"    const task = byId.get(id);",
						"\n",
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: showDel ? "bg-danger/10 text-danger line-through decoration-danger/70" : "text-muted",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-subtle",
								children: "31"
							}), "    return task;"]
						}),
						showDel ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: ["\n", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "bg-ok/10 text-ok",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-subtle",
									children: "32"
								}),
								typedGuard.text,
								!typedGuard.done ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "caret-blink" }) : null
							]
						})] }) : null
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
					className: "border-t border-border p-3 md:border-t-0 md:border-l",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[0.65rem] font-medium tracking-[0.14em] text-subtle uppercase",
							children: "Composer"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-2 min-h-10 text-sm leading-relaxed text-fg",
							children: [typed.text, phase === 1 && !typed.done ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "caret-blink" }) : null]
						}),
						showCost ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "demo-line is-on mt-1 text-xs text-subtle",
							children: "This run = 1 hosted turn"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-xs text-subtle/0",
							children: "This run = 1 hosted turn"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 rounded-lg border border-border bg-bg px-2.5 py-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[0.65rem] tracking-[0.14em] text-subtle uppercase",
								children: "Plan"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-1.5 space-y-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlanRow, {
										n: "01",
										label: "Read store.ts",
										state: plan1
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlanRow, {
										n: "02",
										label: "Patch listTasks slice",
										state: plan2
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlanRow, {
										n: "03",
										label: "Guard getTask",
										state: plan3
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-mono text-xs text-subtle",
								children: "Edit · src/store.ts"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: cn("rounded-md px-2 py-0.5 text-xs font-medium transition-colors duration-300", staged ? "bg-ok/15 text-ok" : "bg-elevated text-subtle"),
								children: staged ? "Apply" : "Review"
							})]
						})
					]
				})
			]
		})]
	});
}
var SNIPPETS = [
	{
		id: "diff",
		file: "src/store.ts",
		tab: "Diff",
		caption: "The edit, as a search-replace you can read.",
		mode: "lines",
		lines: [
			{
				mark: " ",
				text: "export function listTasks() {"
			},
			{
				mark: " ",
				text: "  const start = page * pageSize;"
			},
			{
				mark: "+",
				text: "  return tasks.slice(start, start + pageSize);"
			},
			{
				mark: " ",
				text: "}"
			},
			{
				mark: " ",
				text: ""
			},
			{
				mark: " ",
				text: "export function getTask(id: ID) {"
			},
			{
				mark: " ",
				text: "  const task = byId.get(id);"
			},
			{
				mark: "-",
				text: "  return task;"
			},
			{
				mark: "+",
				text: "  if (!task) throw new NotFound(id);"
			},
			{
				mark: "+",
				text: "  return task;"
			},
			{
				mark: " ",
				text: "}"
			}
		]
	},
	{
		id: "plan",
		file: "plan.json",
		tab: "Plan",
		caption: "A checklist before the first write. Nothing is staged yet.",
		mode: "type",
		lines: [
			{ text: "[" },
			{ text: "  { \"id\": \"01\", \"content\": \"Read store.ts\", \"status\": \"completed\" }," },
			{ text: "  { \"id\": \"02\", \"content\": \"Patch listTasks slice\", \"status\": \"in_progress\" }," },
			{ text: "  { \"id\": \"03\", \"content\": \"Guard getTask\", \"status\": \"pending\" }" },
			{ text: "]" }
		]
	},
	{
		id: "apply",
		file: "composer.ts",
		tab: "Apply",
		caption: "You apply. Undo this run restores the files from before the send.",
		mode: "type",
		lines: [
			{ text: "await applyEdit({" },
			{ text: "  path: \"src/store.ts\"," },
			{ text: "  search: \"return task;\"," },
			{ text: "  replace: \"if (!task) throw new NotFound(id);\\n  return task;\"," },
			{ text: "});" }
		]
	}
];
function tint(text) {
	return text.split(/(\bexport\b|\bfunction\b|\breturn\b|\bconst\b|\bif\b|\bthrow\b|\bnew\b|\bawait\b|"[^"]*"|'[^']*')/g).map((part, i) => {
		if (!part) return null;
		if (/^(export|function|return|const|if|throw|new|await)$/.test(part)) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-accent",
			children: part
		}, i);
		if (part.startsWith("\"") || part.startsWith("'")) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-ok",
			children: part
		}, i);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: part }, i);
	});
}
function LineRow({ line, n, on }) {
	const mark = line.mark ?? " ";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("demo-line flex gap-3 px-4 font-mono text-xs leading-6", on && "is-on", mark === "+" && "bg-ok/10 text-ok", mark === "-" && "bg-danger/10 text-danger", mark === " " && "text-muted"),
		style: { animationDelay: `${n * 55}ms` },
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "w-3 shrink-0 select-none text-subtle",
			children: mark === " " ? "\xA0" : mark
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "min-w-0 whitespace-pre",
			children: tint(line.text) || "\xA0"
		})]
	});
}
function TypedBlock({ source, active, reduced }) {
	const typed = useTyped(source, active, reduced, 12);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("pre", {
		className: "overflow-x-auto px-4 py-3 font-mono text-xs leading-6 text-muted whitespace-pre",
		children: [tint(typed.text), active && !typed.done ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "caret-blink" }) : null]
	});
}
function SnippetShowcase() {
	const reduced = usePrefersReducedMotion();
	const [active, setActive] = (0, import_react.useState)(0);
	const [paused, setPaused] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (reduced || paused) return;
		const id = window.setInterval(() => setActive((n) => (n + 1) % SNIPPETS.length), 5200);
		return () => window.clearInterval(id);
	}, [reduced, paused]);
	const snippet = SNIPPETS[active];
	const source = snippet.lines.map((l) => l.text).join("\n");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid items-start gap-8 lg:grid-cols-[14rem_1fr]",
		onMouseEnter: () => setPaused(true),
		onMouseLeave: () => setPaused(false),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex gap-2 lg:flex-col",
			children: SNIPPETS.map((item, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => setActive(i),
				className: cn("rounded-lg border px-3 py-2 text-left text-sm transition-colors duration-200", i === active ? "border-accent/40 bg-elevated text-fg" : "border-border text-muted hover:text-fg"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-xs text-subtle",
					children: item.tab
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "mt-0.5 block font-medium tracking-tight",
					children: item.file
				})]
			}, item.id))
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-float)]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex h-10 items-center gap-2 border-b border-border px-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2 rounded-full bg-border" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2 rounded-full bg-border" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2 rounded-full bg-border" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ml-2 font-mono text-xs text-subtle",
						children: snippet.file
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ml-auto hidden font-mono text-xs text-ok sm:inline",
						children: snippet.mode === "lines" ? "staged" : "streaming"
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "min-h-56 py-2",
				children: snippet.mode === "type" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TypedBlock, {
					source,
					active: true,
					reduced
				}, snippet.id) : snippet.lines.map((line, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LineRow, {
					line,
					n: i,
					on: true
				}, `${snippet.id}-${i}`))
			}, snippet.id)]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-3 text-sm text-muted",
			children: snippet.caption
		})] })]
	});
}
var LINE1 = [
	"See",
	"the",
	"whole",
	"repo."
];
var LINE2 = [
	"Change",
	"the",
	"right",
	"files."
];
var HOW = [
	{
		n: "01",
		title: "Open a project",
		body: "Drop a folder, a zip, or a public GitHub link. Aperture indexes it in the browser. node_modules stays out."
	},
	{
		n: "02",
		title: "Ask Composer",
		body: "Write it like you’d tell a teammate. The footer shows the cost first. Composer posts a plan before any edit."
	},
	{
		n: "03",
		title: "Apply the diffs",
		body: "Green and red, per file. Apply one, apply all, or reject. Undo this run restores the files from before that send."
	}
];
var PILLARS = [
	{
		id: "plan",
		title: "A plan before the first edit",
		body: "Composer writes a short checklist, then the diffs. You always see what it intends before anything is staged.",
		visual: "plan"
	},
	{
		id: "cost",
		title: "Cost before you send",
		body: "The next run is labeled in the footer: “This run = 1 hosted turn” or “on your Claude key, ~$0.12”. Cursor hides that meter.",
		visual: "cost"
	},
	{
		id: "model",
		title: "You pick the model. No Auto.",
		body: "Hosted Grok, or your Grok, GPT, Claude, Gemini, or DeepSeek. If a key is missing we say so. We never silently switch pools.",
		visual: "model"
	},
	{
		id: "agents",
		title: "Agents share the same diffs",
		body: "Claude Code, Codex, and OpenCode stream into this panel. Same plan. Same Apply. Pro, not Ultra-gated.",
		visual: "agents"
	}
];
var FAQ = [
	{
		q: "What is Aperture, in one sentence?",
		a: "An AI code editor: you open a project, ask Composer in English, review the diffs, and apply what you want."
	},
	{
		q: "Do I have to use your model?",
		a: "No. You pick Hosted Grok, your Grok, your GPT, Claude, Gemini, or DeepSeek. There is no Auto and no silent fallback. Hobby allows one key; Pro and Team allow all five. Your own API usage is billed by that provider, not by us."
	},
	{
		q: "What does a hosted turn cost?",
		a: "One Composer send is one hosted turn — the whole tool loop, not each grep. You see the cost before you send. Session cap is on by default: 8 hosted turns or about $1 on your keys, then we stop."
	},
	{
		q: "Are agents only on a high plan?",
		a: "No. Composer, Chat, and Inline are the product on Hobby. Pro adds Tab ghost-text, one background job, and ACP sessions for Claude Code, Codex, and OpenCode in the same diff UI. Team gets three background jobs."
	},
	{
		q: "How do I take the code with me?",
		a: "Download a zip from the Open menu, the command palette, or ⌘S / Ctrl+S. Secrets like .env never enter the zip. Apply is not final — Undo this run restores the files from before that Composer send."
	},
	{
		q: "Where does my code go?",
		a: "Folder and zip stay in the browser. GitHub import fetches a public zipball once, then the workspace lives locally. When Composer runs, it sends only the snippets the agent reads — not a zip of the repo. Keys are encrypted at rest."
	},
	{
		q: "Will you charge a card here?",
		a: "Plans activate on the account so you can feel the limits. No card is charged in this preview."
	}
];
function HeroCtas() {
	const { user, isPending } = useCurrentUserState();
	if (isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mt-8 h-12 w-64 animate-pulse rounded-xl bg-elevated" });
	if (user) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-8 flex flex-col gap-3 sm:flex-row",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
			to: "/app",
			className: cn(buttonVariants({ size: "lg" })),
			children: ["Open the editor", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-4" })]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/settings",
			search: { tab: "models" },
			className: cn(buttonVariants({
				variant: "outline",
				size: "lg"
			})),
			children: "Connect models"
		})]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-8 flex flex-col gap-3 sm:flex-row",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
			to: "/login",
			search: { next: "/app" },
			className: cn(buttonVariants({ size: "lg" })),
			children: ["Start free", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-4" })]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/app",
			className: cn(buttonVariants({
				variant: "outline",
				size: "lg"
			})),
			children: "Watch it in the editor"
		})]
	});
}
function HeroWords({ words, start }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: words.map((word, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: "hero-word",
		style: { animationDelay: `${start + i * 70}ms` },
		children: [word, i < words.length - 1 ? "\xA0" : ""]
	}, `${start}-${word}`)) });
}
function PillarVisual({ id }) {
	if (id === "plan") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-2xl border border-border bg-surface p-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-xs tracking-[0.14em] text-subtle uppercase",
			children: "Plan"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-4 space-y-3 text-sm",
			children: [
				[
					"01",
					"Read store.ts",
					"done"
				],
				[
					"02",
					"Patch listTasks",
					"run"
				],
				[
					"03",
					"Stage the diff",
					"wait"
				]
			].map(([n, label, state]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex items-center gap-3",
				children: [state === "done" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {
					className: "size-4 text-ok",
					strokeWidth: 2.4
				}) : state === "run" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-4 rounded-full border border-accent" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-4 rounded-full border border-border" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: state === "wait" ? "text-subtle" : "text-fg",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-xs text-subtle",
							children: n
						}),
						" ",
						label
					]
				})]
			}, n))
		})]
	});
	if (id === "cost") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-2xl border border-border bg-surface p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-[0.14em] text-subtle uppercase",
				children: "Before send"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-2xl font-medium tracking-tight",
				children: "This run = 1 hosted turn"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted",
				children: "or on your Claude key, ~$0.12. Session cap is on — 8 turns or about $1, then we stop."
			})
		]
	});
	if (id === "model") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-2xl border border-border bg-surface p-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-xs tracking-[0.14em] text-subtle uppercase",
			children: "Composer menu"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-4 space-y-2",
			children: [
				"Hosted Grok",
				"Your GPT",
				"Your Claude",
				"Your Gemini",
				"Your DeepSeek"
			].map((label, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: cn("rounded-lg border px-3 py-2 text-sm", i === 0 ? "border-accent/40 bg-elevated text-fg" : "border-border text-muted"),
				children: label
			}, label))
		})]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-2xl border border-border bg-surface p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-[0.14em] text-subtle uppercase",
				children: "Same diff UI"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 flex flex-wrap gap-2",
				children: [
					"Claude Code",
					"Codex",
					"OpenCode"
				].map((name) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "rounded-md border border-border bg-bg px-2.5 py-1 text-sm text-fg",
					children: name
				}, name))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 rounded-lg border border-border bg-bg px-3 py-2 font-mono text-xs text-ok",
				children: "+ return tasks.slice(start, start + pageSize);"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-right text-xs text-ok",
				children: "Apply"
			})
		]
	});
}
function Pillars() {
	const reduced = usePrefersReducedMotion();
	const [active, setActive] = (0, import_react.useState)(0);
	const [paused, setPaused] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (reduced || paused) return;
		const id = window.setInterval(() => setActive((n) => (n + 1) % PILLARS.length), 4200);
		return () => window.clearInterval(id);
	}, [reduced, paused]);
	const pillar = PILLARS[active];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid items-start gap-10 lg:grid-cols-[1.1fr_0.9fr]",
		onMouseEnter: () => setPaused(true),
		onMouseLeave: () => setPaused(false),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: PILLARS.map((item, i) => {
			const on = i === active;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => setActive(i),
				className: cn("block w-full border-l-2 py-4 pr-4 pl-4 text-left transition-colors duration-200", on ? "border-accent bg-elevated/40" : "border-border hover:border-muted"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: cn("text-lg font-medium tracking-tight", on ? "text-fg" : "text-muted"),
					children: item.title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: cn("overflow-hidden text-sm leading-relaxed text-pretty text-muted transition-all duration-300", on ? "mt-2 max-h-32 opacity-100" : "mt-0 max-h-0 opacity-0"),
					children: item.body
				})]
			}, item.id);
		}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "lg:sticky lg:top-24",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PillarVisual, { id: pillar.visual }, pillar.id)
		})]
	});
}
function Landing() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh bg-bg text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteNav, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
					className: "landing-spot relative overflow-hidden",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6 sm:pt-20 sm:pb-24",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "landing-in text-xs font-medium tracking-[0.18em] text-subtle uppercase",
								style: { animationDelay: "40ms" },
								children: "The AI code editor"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
								className: "mt-5 max-w-4xl text-4xl font-medium tracking-tight sm:text-6xl sm:leading-[1.05]",
								"aria-label": "See the whole repo. Change the right files.",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeroWords, {
										words: LINE1,
										start: 80
									})
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "mt-1 block text-muted",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeroWords, {
										words: LINE2,
										start: 360
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "landing-in mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted sm:text-lg",
								style: { animationDelay: "720ms" },
								children: "Open a project. Ask Composer in English. It plans, then shows diffs. You apply what you want. The cost of that send is on screen before you hit enter."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "landing-in",
								style: { animationDelay: "880ms" },
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeroCtas, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-3 text-sm text-subtle",
									children: "Hobby · 50 hosted turns · agents included · session cap on · no card"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "landing-in mt-12",
								style: { animationDelay: "1040ms" },
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProductDemo, {})
							})
						]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
					id: "how",
					className: "border-t border-border",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mx-auto max-w-6xl px-4 py-20 sm:px-6",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Reveal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs font-medium tracking-[0.18em] text-subtle uppercase",
							children: "How it works"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mt-3 max-w-2xl text-3xl font-medium tracking-tight text-balance sm:text-4xl",
							children: "Three steps. Nothing writes until you say so."
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Reveal, {
							className: "relative mt-12",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "how-rail absolute top-5 right-8 left-8 hidden h-px bg-border sm:block" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid gap-10 sm:grid-cols-3",
								children: HOW.map((step) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "font-mono text-xs tracking-wide text-accent",
										children: step.n
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "mt-3 text-xl font-medium tracking-tight",
										children: step.title
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-2 text-sm leading-relaxed text-pretty text-muted",
										children: step.body
									})
								] }, step.n))
							})]
						})]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
					id: "code",
					className: "border-t border-border",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mx-auto max-w-6xl px-4 py-20 sm:px-6",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Reveal, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs font-medium tracking-[0.18em] text-subtle uppercase",
								children: "The edit"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "mt-3 max-w-2xl text-3xl font-medium tracking-tight text-balance sm:text-4xl",
								children: "Specific snippets. Same run."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-3 max-w-xl text-pretty text-muted",
								children: "Composer does not dump a whole file. You get the plan, the exact lines, and the apply call — typed as they land."
							})
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-12",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Reveal, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SnippetShowcase, {}) })
						})]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
					id: "why",
					className: "border-t border-border",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mx-auto max-w-6xl px-4 py-20 sm:px-6",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Reveal, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs font-medium tracking-[0.18em] text-subtle uppercase",
								children: "Why Aperture"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "mt-3 max-w-2xl text-3xl font-medium tracking-tight text-balance sm:text-4xl",
								children: "Built so you can see the work — and the bill."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-3 max-w-xl text-pretty text-muted",
								children: "Composer, Chat, and Inline are the product on every plan. The rest is honesty: a visible meter, a model you chose, a cap that actually stops."
							})
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-12",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Reveal, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pillars, {}) })
						})]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
					className: "border-t border-border",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mx-auto max-w-6xl px-4 py-20 sm:px-6",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Reveal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs font-medium tracking-[0.18em] text-subtle uppercase",
							children: "The workspace"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mt-3 text-3xl font-medium tracking-tight sm:text-4xl",
							children: "Your repo. Your keys. Your apply."
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-12 grid gap-6 sm:grid-cols-3",
							children: [
								{
									icon: Layers,
									title: "Indexed in the browser",
									body: "Functions and classes are chunked locally. Composer searches the whole project, not just the open tab."
								},
								{
									icon: Sparkles,
									title: "Diffs you approve",
									body: "Every edit is a search-replace you can read. Reject is one click. Undo this run restores the previous files."
								},
								{
									icon: ShieldCheck,
									title: "Caps, not invoices",
									body: "Session cap is on by default. One send is one hosted turn, including every grep in the loop. Tab uses a fast model."
								}
							].map((item, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Reveal, {
								delay: i * 90,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
									className: "h-full rounded-2xl border border-border bg-surface p-6",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(item.icon, {
											className: "size-5 text-accent",
											strokeWidth: 1.6
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
											className: "mt-4 text-lg font-medium tracking-tight",
											children: item.title
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "mt-2 text-sm leading-relaxed text-pretty text-muted",
											children: item.body
										})
									]
								})
							}, item.title))
						})]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
					id: "models",
					className: "border-t border-border",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mx-auto max-w-6xl px-4 py-20 sm:px-6",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Reveal, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-start gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeyRound, {
									className: "mt-1 size-5 text-accent",
									strokeWidth: 1.6
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "text-3xl font-medium tracking-tight sm:text-4xl",
									children: "Your models. Your keys."
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-3 max-w-xl text-pretty text-muted",
									children: "Composer uses the model in the menu. If that key is missing, we tell you. Hosted Grok is a choice, not a fallback."
								})] })]
							}) }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
								children: PROVIDERS.map((provider, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Reveal, {
									delay: i * 80,
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
										className: "rounded-2xl border border-border bg-surface p-5",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-sm font-medium",
												children: provider.label
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "mt-1 text-sm text-subtle",
												children: provider.hint
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "mt-4 text-sm leading-relaxed text-muted",
												children: provider.id === "grok" ? "Hosted on every plan, or bring your own xAI key." : "Bring your own key. Counts toward the plan’s key slots."
											})
										]
									})
								}, provider.id))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Reveal, {
								delay: 200,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/settings",
									search: { tab: "models" },
									className: cn(buttonVariants({ variant: "outline" }), "mt-8"),
									children: "Open model settings"
								})
							})
						]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
					className: "border-t border-border",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mx-auto max-w-6xl px-4 py-20 sm:px-6",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Reveal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-center text-3xl font-medium tracking-tight sm:text-4xl",
							children: "Simple plans. Honest limits."
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mx-auto mt-3 max-w-lg text-center text-pretty text-muted",
							children: "Hosted Grok is metered. One send is one turn. Session cap is on. Your keys are unlimited agent runs — we never markup their tokens."
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-12",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PricingTable, {})
						})]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
					className: "border-t border-border",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mx-auto max-w-3xl px-4 py-20 sm:px-6",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Reveal, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-3xl font-medium tracking-tight sm:text-4xl",
							children: "Questions"
						}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-8 divide-y divide-border border-y border-border",
							children: FAQ.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
								className: "group py-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", {
									className: "cursor-pointer list-none text-base font-medium tracking-tight [&::-webkit-details-marker]:hidden",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "flex items-center justify-between gap-4",
										children: [item.q, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-subtle transition-transform duration-200 group-open:rotate-45",
											children: "+"
										})]
									})
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 max-w-prose text-sm leading-relaxed text-pretty text-muted",
									children: item.a
								})]
							}, item.q))
						})]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
					className: "border-t border-border",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mx-auto max-w-6xl px-4 py-20 sm:px-6",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Reveal, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "max-w-xl text-3xl font-medium tracking-tight text-balance sm:text-4xl",
								children: "Ready when you are."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-3 max-w-lg text-pretty text-muted",
								children: "Create an account, pick Hobby, and open the editor. Add keys later if you already pay OpenAI, Anthropic, or xAI."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-8 flex flex-col gap-3 sm:flex-row",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
									to: "/login",
									search: { next: "/app" },
									className: cn(buttonVariants({ size: "lg" })),
									children: ["Start free", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-4" })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/pricing",
									className: cn(buttonVariants({
										variant: "outline",
										size: "lg"
									})),
									children: "Compare plans"
								})]
							})
						] })
					})
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteFooter, {})
		]
	});
}
var SplitComponent = Landing;
//#endregion
export { SplitComponent as component };
