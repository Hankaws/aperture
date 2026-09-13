import { o as __toESM } from "../_runtime.mjs";
import { n as BUILTIN_ACP, t as ACP_KINDS } from "./kinds-CCf1JBpH.mjs";
import { a as planById, n as PROVIDERS } from "./plans-CTIRB29R.mjs";
import { r as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { _ as Link, v as Navigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { r as formatUsd, t as MAX_SESSION_CENTS } from "./cost-_vUFI9Un.mjs";
import { a as setModelSource, i as saveProviderKey, r as resetSession, s as setSessionCap } from "./api-CT8K4ti-.mjs";
import { n as cn } from "./utils-DTfuEt1f.mjs";
import { a as buttonVariants, r as Button } from "./auth-slot-TCLjKAfg.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { a as deleteAgent, c as useAccount, i as Input, n as Route$3, o as listAgents, s as saveAgent } from "./router-CDpB3DuN.mjs";
import { t as SiteNav } from "./site-nav-BSNhfuul.mjs";
import { n as SiteFooter, t as PricingTable } from "./pricing-table-Bteo47lM.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings-QVTEAzbO.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function ModelKeys({ account, onAccount }) {
	const [tab, setTab] = (0, import_react.useState)(account.preferredProvider);
	const plan = planById(account.plan);
	const slotsLeft = Math.max(0, account.byokSlots - account.keyCount);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-xl font-medium tracking-tight",
					children: "API keys"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 max-w-xl text-sm text-pretty text-muted",
					children: [
						"Attach the keys you already pay for. ",
						plan.name,
						" allows ",
						plan.byokSlots,
						" ",
						plan.byokSlots === 1 ? "provider" : "providers",
						". Hosted Grok does not use a slot. Keys are encrypted at rest and never sent back to the browser — only the last four characters."
					]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-sm tabular-nums text-subtle",
					children: [
						account.keyCount,
						" / ",
						account.byokSlots,
						" keys"
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "rounded-2xl border border-border bg-surface p-5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-start justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm font-medium",
						children: "Hosted Grok"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-subtle",
						children: "Included on the plan. One send = one turn."
					})] }), account.modelSource === "hosted" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "rounded-full border border-ok/30 bg-ok/10 px-2 py-0.5 text-xs text-ok",
						children: "Selected"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						size: "sm",
						onClick: async () => {
							try {
								onAccount(await setModelSource({ data: "hosted" }));
							} catch (error) {
								toast.error(error instanceof Error ? error.message : "Could not switch");
							}
						},
						children: "Use hosted Grok"
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-wrap rounded-lg border border-border p-1",
				children: PROVIDERS.map((provider) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setTab(provider.id),
					className: cn("h-11 min-w-[5.5rem] flex-1 rounded-md px-2 text-sm", tab === provider.id ? "bg-elevated text-fg" : "text-muted hover:text-fg"),
					children: provider.short
				}, provider.id))
			}),
			PROVIDERS.map((provider) => tab === provider.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProviderPanel, {
				provider: provider.id,
				label: provider.label,
				hint: provider.hint,
				placeholder: provider.placeholder,
				account,
				slotsLeft,
				onAccount
			}, provider.id) : null),
			account.plan === "hobby" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm text-muted",
				children: [
					"Need GPT, Claude, Gemini, and DeepSeek together?",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/pricing",
						className: cn(buttonVariants({
							variant: "ghost",
							size: "sm"
						}), "h-auto px-1"),
						children: "Upgrade to Pro"
					})
				]
			})
		]
	});
}
function ProviderPanel({ provider, label, hint, placeholder, account, slotsLeft, onAccount }) {
	const status = account.keys[provider];
	const locked = !status.set && slotsLeft <= 0;
	const [value, setValue] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const preferred = account.modelSource === provider;
	async function save() {
		const key = value.trim();
		if (!key) return;
		setBusy(true);
		try {
			onAccount(await saveProviderKey({ data: {
				provider,
				key
			} }));
			setValue("");
			toast.success(`${label} key saved`);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not save key");
		} finally {
			setBusy(false);
		}
	}
	async function remove() {
		setBusy(true);
		try {
			onAccount(await saveProviderKey({ data: {
				provider,
				key: ""
			} }));
			toast.success(`${label} key removed`);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not remove key");
		} finally {
			setBusy(false);
		}
	}
	async function prefer() {
		try {
			onAccount(await setModelSource({ data: provider }));
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not update preferred model");
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-2xl border border-border bg-surface p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-start justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm font-medium",
					children: label
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-subtle",
					children: hint
				})] }), status.set ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "rounded-full border border-ok/30 bg-ok/10 px-2 py-0.5 text-xs text-ok",
					children: ["Linked · ", status.last4]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "rounded-full border border-border px-2 py-0.5 text-xs text-subtle",
					children: "Not linked"
				})]
			}),
			locked ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-4 text-sm text-muted",
				children: [
					planById(account.plan).name,
					" only allows ",
					account.byokSlots,
					" key. Remove the one you have, or upgrade to add",
					" ",
					label,
					"."
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-4 flex flex-col gap-2 sm:flex-row",
				onSubmit: (event) => {
					event.preventDefault();
					save();
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					type: "password",
					autoComplete: "off",
					spellCheck: false,
					value,
					onChange: (event) => setValue(event.target.value),
					placeholder: status.set ? `Replace key (${placeholder})` : placeholder,
					className: "font-mono"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					disabled: busy || value.trim().length < 8,
					className: "sm:w-36",
					children: busy ? "Saving…" : status.set ? "Replace" : "Save key"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex flex-wrap items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: preferred ? "subtle" : "outline",
					size: "sm",
					disabled: preferred,
					onClick: () => void prefer(),
					children: preferred ? "Preferred" : "Use in Composer"
				}), status.set && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "ghost",
					size: "sm",
					disabled: busy,
					onClick: () => void remove(),
					children: "Remove"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-xs leading-relaxed text-subtle",
				children: "Encrypted at rest. Composer uses the model you pick — never Auto, never a silent fallback. Switch to Hosted Grok from the Composer menu if you want the included turns."
			})
		]
	});
}
function SessionLimits({ account, onAccount }) {
	const [on, setOn] = (0, import_react.useState)(account.session.on);
	const [turns, setTurns] = (0, import_react.useState)(String(account.session.capTurns));
	const [dollars, setDollars] = (0, import_react.useState)((account.session.capCents / 100).toFixed(2));
	const [busy, setBusy] = (0, import_react.useState)(false);
	async function save() {
		setBusy(true);
		try {
			const nextTurns = Math.min(80, Math.max(1, Number(turns) || 8));
			const cents = Math.round(Number(dollars) * 100);
			onAccount(await setSessionCap({ data: {
				on,
				turns: nextTurns,
				cents: Math.min(MAX_SESSION_CENTS, Math.max(25, Number.isFinite(cents) ? cents : 100))
			} }));
			toast.success("Session cap saved");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not save cap");
		} finally {
			setBusy(false);
		}
	}
	async function reset() {
		setBusy(true);
		try {
			onAccount(await resetSession());
			toast.success("Session counters reset");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not reset");
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-xl font-medium tracking-tight",
				children: "Session cap"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 max-w-xl text-sm text-pretty text-muted",
				children: [
					"On by default. Hosted Grok stops after ",
					account.session.capTurns,
					" sends this session. Your own keys stop around ",
					formatUsd(account.session.capCents),
					". Monthly quota still applies. The runaway hour cannot happen here."
				]
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-2xl border border-border bg-surface p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex items-center justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-sm",
							children: "Cap this session"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							role: "switch",
							"aria-checked": on,
							onClick: () => setOn((v) => !v),
							className: `relative h-6 w-10 rounded-full ${on ? "bg-accent" : "bg-elevated"}`,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `absolute top-0.5 size-5 rounded-full bg-fg transition-transform ${on ? "left-4" : "left-0.5"}` })
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-5 grid gap-4 sm:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "block text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-muted",
								children: "Hosted turns"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								type: "number",
								min: 1,
								max: 80,
								value: turns,
								onChange: (e) => setTurns(e.target.value),
								className: "mt-1"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "block text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-muted",
								children: "BYOK dollars"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								type: "number",
								min: 25 / 100,
								max: MAX_SESSION_CENTS / 100,
								step: "0.25",
								value: dollars,
								onChange: (e) => setDollars(e.target.value),
								className: "mt-1"
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-3 text-xs text-subtle",
						children: [
							"This session: ",
							account.session.turns,
							" hosted turns, ",
							formatUsd(account.session.cents),
							" on your keys. One Composer send is one turn — greps inside the loop are free."
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 flex flex-wrap gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							onClick: () => void save(),
							disabled: busy,
							children: busy ? "Saving…" : "Save cap"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "outline",
							onClick: () => void reset(),
							disabled: busy,
							children: "Reset session"
						})]
					}),
					!on && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-xs text-warn",
						children: "Cap is off. Hosted Grok still stops at the monthly plan limit. Your provider will bill every BYOK send."
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-2xl border border-border bg-surface p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "text-sm font-medium",
					children: "Tab ghost-text"
				}), account.tab ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-2 text-sm text-muted",
					children: [
						"Fast model only — never grok-4.5 per keystroke. Hosted Tab is ",
						account.tabUsed,
						" / ",
						account.tabCap,
						" today. Attach your own key and Tab is uncapped on that provider."
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-3 h-2 overflow-hidden rounded-full bg-elevated",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "h-full rounded-full bg-accent",
						style: { width: `${account.tabCap > 0 ? Math.min(100, account.tabUsed / account.tabCap * 100) : 0}%` }
					})
				})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted",
					children: "Tab is on Pro. Composer, Chat, and Inline still run on Hobby."
				})]
			})
		]
	});
}
function ExternalAgents({ account }) {
	const [agents, setAgents] = (0, import_react.useState)([]);
	const [name, setName] = (0, import_react.useState)("");
	const [kind, setKind] = (0, import_react.useState)("claude-code");
	const [endpoint, setEndpoint] = (0, import_react.useState)("");
	const [token, setToken] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (!account.acp) return;
		listAgents().then(setAgents).catch(() => setAgents([]));
	}, [account.acp]);
	if (!account.acp) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-2xl border border-border bg-surface p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-xl font-medium tracking-tight",
				children: "External agents"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 max-w-xl text-sm text-pretty text-muted",
				children: "Pro runs Claude Code, Codex, and OpenCode as ACP sessions in Composer — plan, traces, and the same staged diffs. Hobby still has Composer, Chat, and Inline."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/pricing",
				className: cn(buttonVariants(), "mt-4"),
				children: "See Pro"
			})
		]
	});
	async function add() {
		setBusy(true);
		try {
			const next = await saveAgent({ data: {
				name,
				kind,
				endpoint,
				token
			} });
			setAgents(next);
			setName("");
			setEndpoint("");
			setToken("");
			toast.success("Bridge connected");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not save agent");
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-xl font-medium tracking-tight",
				children: "External agents"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-xl text-sm text-pretty text-muted",
				children: "Pick Claude Code, Codex, or OpenCode in the Composer model menu. They speak ACP in this panel — checklist, tool calls, staged diffs. A remote JSON-RPC bridge is optional if you already pay for a CLI."
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "grid gap-3 sm:grid-cols-3",
				children: BUILTIN_ACP.map((agent) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "rounded-2xl border border-border bg-surface p-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm font-medium",
						children: agent.name
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-subtle",
						children: "Built-in ACP · same diff UI · uses the model you pick"
					})]
				}, agent.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-2xl border border-border bg-surface p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm font-medium",
						children: "Remote ACP bridge"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-xs text-subtle",
						children: [
							"JSON-RPC: initialize → session/new → session/prompt. session/update plan and diff blocks land here. Falls back to POST aperture.acp.v1 ",
							"{ text, edits }",
							". No hosted turn."
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						className: "mt-4 grid gap-3",
						onSubmit: (e) => {
							e.preventDefault();
							add();
						},
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid gap-3 sm:grid-cols-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									value: name,
									onChange: (e) => setName(e.target.value),
									placeholder: "Name"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
									value: kind,
									onChange: (e) => setKind(e.target.value),
									className: "h-10 rounded-lg border border-border bg-bg px-3 text-sm text-fg",
									children: ACP_KINDS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: item.id,
										children: item.label
									}, item.id))
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								value: endpoint,
								onChange: (e) => setEndpoint(e.target.value),
								placeholder: "https://bridge.example/acp",
								className: "font-mono"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								type: "password",
								autoComplete: "off",
								value: token,
								onChange: (e) => setToken(e.target.value),
								placeholder: "Bearer token (optional)",
								className: "font-mono"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "submit",
								disabled: busy || name.trim().length < 2 || endpoint.trim().length < 8,
								className: "sm:w-40",
								children: busy ? "Saving…" : "Add bridge"
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "space-y-3",
				children: agents.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "text-sm text-muted",
					children: "No remote bridges. Built-in ACP is already in the Composer picker."
				}) : agents.map((agent) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "truncate text-sm font-medium",
							children: agent.name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "truncate text-xs text-subtle",
							children: [
								ACP_KINDS.find((k) => k.id === agent.kind)?.label,
								" · ",
								agent.endpoint
							]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "ghost",
						onClick: async () => {
							try {
								setAgents(await deleteAgent({ data: agent.id }));
							} catch (error) {
								toast.error(error instanceof Error ? error.message : "Could not remove");
							}
						},
						children: "Remove"
					})]
				}, agent.id))
			})
		]
	});
}
var TABS = [
	{
		id: "plan",
		label: "Plan"
	},
	{
		id: "models",
		label: "Models"
	},
	{
		id: "limits",
		label: "Limits"
	},
	{
		id: "agents",
		label: "Agents"
	}
];
function SettingsPage() {
	const { tab } = Route$3.useSearch();
	const { account, setAccount, user, isPending } = useAccount();
	if (isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh bg-bg",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteNav, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mx-auto mt-16 h-64 max-w-3xl animate-pulse rounded-2xl bg-elevated" })]
	});
	if (!user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigate, {
		to: "/login",
		search: { next: "/settings" }
	});
	const plan = account ? planById(account.plan) : planById("hobby");
	const usedPct = account && account.hostedTurns > 0 ? Math.min(100, account.hostedUsed / account.hostedTurns * 100) : 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh bg-bg text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteNav, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
				className: "mx-auto max-w-3xl px-4 py-10 sm:px-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-medium tracking-[0.16em] text-subtle uppercase",
						children: "Account"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "mt-2 text-3xl font-medium tracking-tight",
						children: "Settings"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted",
						children: "Plan limits hosted Grok. You pick the model — there is no Auto. Session cap is on by default."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-8 flex rounded-lg border border-border p-1",
						children: TABS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/settings",
							search: { tab: item.id },
							replace: true,
							className: cn("flex h-11 flex-1 items-center justify-center rounded-md text-sm", tab === item.id ? "bg-elevated text-fg" : "text-muted hover:text-fg"),
							children: item.label
						}, item.id))
					}),
					tab === "plan" && account && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "mt-8 space-y-8",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-2xl border border-border bg-surface p-5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap items-start justify-between gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-sm text-subtle",
											children: "Current plan"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "mt-1 text-2xl font-medium tracking-tight",
											children: plan.name
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "mt-1 text-sm text-muted",
											children: plan.blurb
										})
									] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
										to: "/pricing",
										className: cn(buttonVariants({
											variant: "outline",
											size: "sm"
										})),
										children: "Change plan"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-6",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center justify-between text-sm",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-muted",
												children: "Hosted Grok this month"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "tabular-nums",
												children: [
													account.hostedUsed,
													" / ",
													account.hostedTurns
												]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "mt-2 h-2 overflow-hidden rounded-full bg-elevated",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "h-full rounded-full bg-accent",
												style: { width: `${usedPct}%` }
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "mt-2 text-xs text-subtle",
											children: [
												"One send = one hosted turn, including the whole tool loop. Your own keys never count against this.",
												" ",
												account.keyCount,
												" of ",
												account.byokSlots,
												" key slots used.",
												account.tab ? ` Tab today: ${account.tabUsed} / ${account.tabCap} hosted completions (your key is uncapped).` : " Tab ghost-text is on Pro."
											]
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-5 flex flex-wrap gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
										to: "/settings",
										search: { tab: "models" },
										className: cn(buttonVariants({ size: "sm" })),
										children: "Connect a key"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
										to: "/app",
										className: cn(buttonVariants({
											variant: "outline",
											size: "sm"
										})),
										children: "Open editor"
									})]
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mb-4 text-lg font-medium tracking-tight",
							children: "Switch plan"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PricingTable, { currentPlan: account.plan })] })]
					}),
					tab === "models" && account && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
						className: "mt-8",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModelKeys, {
							account,
							onAccount: setAccount
						})
					}),
					tab === "limits" && account && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
						className: "mt-8",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SessionLimits, {
							account,
							onAccount: setAccount
						})
					}),
					tab === "agents" && account && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
						className: "mt-8",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalAgents, { account })
					}),
					!account && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-8 rounded-2xl border border-border bg-surface p-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted",
							children: "Could not load billing for this account."
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							className: "mt-3",
							variant: "outline",
							onClick: () => window.location.reload(),
							children: "Retry"
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteFooter, {})
		]
	});
}
//#endregion
export { SettingsPage as component };
