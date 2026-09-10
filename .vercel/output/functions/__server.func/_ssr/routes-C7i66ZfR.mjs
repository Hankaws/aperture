import { n as PROVIDERS } from "./plans-DGQaVOnT.mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { n as cn } from "./utils-DTfuEt1f.mjs";
import { a as buttonVariants, o as useCurrentUserState } from "./auth-slot-wt-qTGp_.mjs";
import { I as ArrowRight, _ as KeyRound, h as Layers, s as ShieldCheck, y as GitBranch } from "../_libs/lucide-react.mjs";
import { t as SiteNav } from "./site-nav-tlXxT39a.mjs";
import { n as SiteFooter, t as PricingTable } from "./pricing-table-DUagLe_W.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-C7i66ZfR.js
var import_jsx_runtime = require_jsx_runtime();
function ProductMock() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-float)]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex h-10 items-center gap-2 border-b border-border px-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2 rounded-full bg-border" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2 rounded-full bg-border" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2 rounded-full bg-border" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "ml-2 truncate font-mono text-[11px] text-subtle",
					children: "harbor-api / src/store.ts"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "ml-auto hidden font-mono text-[11px] text-ok sm:inline",
					children: "staged · 1 file"
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid min-h-[260px] md:grid-cols-[9.5rem_1fr_14rem]",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
					className: "hidden border-r border-border p-3 font-mono text-[12px] text-muted md:block",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mb-2 font-sans text-[10px] tracking-[0.14em] text-subtle uppercase",
							children: "Workspace"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-fg",
							children: ".aperture.md"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "src" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "pl-3 text-fg",
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
					className: "overflow-hidden p-4 font-mono text-[11px] leading-6 text-muted",
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
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-ok",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-subtle",
								children: "26"
							}), "    return tasks.slice(start, start + pageSize);"]
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
							className: "text-danger",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-subtle",
								children: "31"
							}), "    return task;"]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
					className: "border-t border-border p-3 md:border-t-0 md:border-l",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] font-medium tracking-wide text-subtle uppercase",
							children: "Claude Code"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-[13px] leading-relaxed text-fg",
							children: "Fix pagination in @src/store.ts"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 rounded-lg border border-border bg-bg px-2 py-1.5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[10px] tracking-[0.14em] text-subtle uppercase",
									children: "Plan"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-[11px] text-ok",
									children: "01 Read store.ts"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11px] text-accent",
									children: "02 Patch listTasks slice"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11px] text-subtle",
									children: "03 Stage the diff"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 font-mono text-[11px] text-subtle",
							children: "Edit · src/store.ts"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 text-[11px] text-muted",
							children: "This run = 1 hosted turn · ACP"
						})
					]
				})
			]
		})]
	});
}
var FEATURES = [
	{
		icon: Layers,
		title: "Your repo, indexed",
		body: "Drop a folder, unzip, or import a public GitHub repo. Functions and classes are chunked in the browser. Semantic search plus keyword hybrid — Composer is not limited to the open tab."
	},
	{
		icon: GitBranch,
		title: "Diffs you approve",
		body: "Every edit is a search-replace you can read. Nothing writes until you apply. Reject is one click."
	},
	{
		icon: KeyRound,
		title: "Grok, GPT, Claude — you pick",
		body: "Hosted Grok is metered on the plan. Attach your own keys in Settings. Composer never silently Auto-switches. The next send shows 1 hosted turn or ~$0.12 on your Claude key."
	},
	{
		icon: ShieldCheck,
		title: "Caps, not invoices",
		body: "Session cap is on by default — 8 hosted turns or about $1 on your keys, then we stop. One send is one hosted turn, including every grep in the loop. Tab uses a fast model on Pro, not grok-4.5 per keystroke."
	}
];
var STEPS = [
	{
		n: "01",
		title: "Open a real project",
		body: "Drop a folder, a zip, or a public GitHub repo. The index replaces the demo. node_modules and binaries stay out."
	},
	{
		n: "02",
		title: "Ask Composer",
		body: "The footer shows the cost of that send first. Composer posts a plan before the first diff. Attach files with @. A .aperture.md Rules file is always in the prompt."
	},
	{
		n: "03",
		title: "Apply what you want",
		body: "Review each file. Apply one, apply all, or reject. Undo this run restores the files from before that send. Download a zip when you are done."
	}
];
var FAQ = [
	{
		q: "Do I have to use your model?",
		a: "No. You pick Hosted Grok, your Grok, your GPT, or your Claude. There is no Auto and no silent fallback. Hobby allows one key; Pro and Team allow all three. Your own API usage is billed by that provider, not by us."
	},
	{
		q: "What does a hosted turn cost?",
		a: "One Composer send is one hosted turn — the whole tool loop, not each grep. You see “This run = 1 hosted turn” (or “on your Claude key, ~$0.15”) before you send. Session cap is on by default: 8 hosted turns or about $1 on your keys, then we stop."
	},
	{
		q: "Are agents only on a high plan?",
		a: "No. Composer, Chat, and Inline are the product on Hobby. Composer always posts a plan before the first diff. Pro adds Tab ghost-text (fast model, 250 hosted completions / day), one background job, and ACP sessions for Claude Code, Codex, and OpenCode in the same diff UI. Team gets three background jobs."
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
			children: "Open the editor"
		})]
	});
}
function Landing() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh bg-bg text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteNav, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pt-20",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs font-medium tracking-[0.18em] text-subtle uppercase",
							children: "The AI code editor"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "rise-in mt-4 max-w-3xl text-balance text-4xl font-medium tracking-tight sm:text-6xl sm:leading-[1.05]",
							children: "See the whole repo. Change the right files."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted sm:text-lg",
							children: "Composer streams, honors @mentions and a Rules file, and stages diffs you approve. The cost of the next send is visible before you hit enter. Hosted Grok — or your Grok, GPT, and Claude keys. You pick. No Auto."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeroCtas, {}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 text-sm text-subtle",
							children: "Hobby · 50 hosted turns · agents included · session cap on · no card"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-12",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProductMock, {})
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
					className: "border-t border-border",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:grid-cols-3 sm:px-6",
						children: STEPS.map((step) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-mono text-xs tracking-wide text-accent",
								children: step.n
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "mt-3 text-lg font-medium tracking-tight",
								children: step.title
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-sm leading-relaxed text-pretty text-muted",
								children: step.body
							})
						] }, step.n))
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
					className: "border-t border-border",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:grid-cols-2 sm:px-6 lg:grid-cols-4",
						children: FEATURES.map((feature) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(feature.icon, {
								className: "size-5 text-accent",
								strokeWidth: 1.6
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "mt-4 text-base font-medium",
								children: feature.title
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-sm leading-relaxed text-pretty text-muted",
								children: feature.body
							})
						] }, feature.title))
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
					className: "border-t border-border",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mx-auto max-w-6xl px-4 py-16 sm:px-6",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-3xl font-medium tracking-tight",
								children: "Your models. Your keys."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-3 max-w-xl text-pretty text-sm text-muted",
								children: "Composer uses the model you pick in the Composer menu. If that key is missing, we tell you — we do not silently switch. Hosted Grok is a choice, not a fallback."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-8 grid gap-4 sm:grid-cols-3",
								children: PROVIDERS.map((provider) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
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
								}, provider.id))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/settings",
								search: { tab: "models" },
								className: cn(buttonVariants({ variant: "outline" }), "mt-6"),
								children: "Open model settings"
							})
						]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
					className: "border-t border-border",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mx-auto max-w-6xl px-4 py-16 sm:px-6",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-center text-3xl font-medium tracking-tight",
								children: "Simple plans. Honest limits."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mx-auto mt-3 max-w-lg text-center text-sm text-muted",
								children: "Hosted Grok is metered. One send is one turn. Session cap is on. Your keys are unlimited agent runs — we never markup their tokens."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-10",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PricingTable, {})
							})
						]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
					className: "border-t border-border",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mx-auto max-w-3xl px-4 py-16 sm:px-6",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-3xl font-medium tracking-tight",
							children: "Questions"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-8 divide-y divide-border border-y border-border",
							children: FAQ.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
								className: "group py-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", {
									className: "cursor-pointer list-none text-base font-medium tracking-tight [&::-webkit-details-marker]:hidden",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "flex items-center justify-between gap-4",
										children: [item.q, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-subtle transition-transform duration-150 group-open:rotate-45",
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
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mx-auto max-w-6xl px-4 py-16 sm:px-6",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "max-w-xl text-3xl font-medium tracking-tight text-balance",
								children: "Ready when you are."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-3 max-w-lg text-sm text-muted",
								children: "Create an account, pick Hobby, and open the editor. Add keys later if you already pay OpenAI, Anthropic, or xAI."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-6 flex flex-col gap-3 sm:flex-row",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/login",
									search: { next: "/app" },
									className: cn(buttonVariants({ size: "lg" })),
									children: "Start free"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/pricing",
									className: cn(buttonVariants({
										variant: "outline",
										size: "lg"
									})),
									children: "Compare plans"
								})]
							})
						]
					})
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteFooter, {})
		]
	});
}
//#endregion
export { Landing as component };
