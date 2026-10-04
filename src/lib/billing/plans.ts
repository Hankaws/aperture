import { acpAgentNames } from "../acp/kinds.ts";

export type PlanId = "hobby" | "pro" | "team";
export type ProviderId = "grok" | "openai" | "anthropic" | "gemini" | "deepseek";
export type ModelSource = "hosted" | "custom" | ProviderId;

export type Plan = {
  id: PlanId;
  name: string;
  blurb: string;
  monthly: number;
  yearlyMonthly: number;
  hostedTurns: number;
  byokSlots: number;
  tab: boolean;
  tabDaily: number;
  backgroundJobs: number;
  /** Sandbox verification runs per day; 0 means the feature is off for this plan. */
  sandboxRuns: number;
  acp: boolean;
  featured?: boolean;
  cta: string;
  features: string[];
};

export const PLANS: Plan[] = [
  {
    id: "hobby",
    name: "Hobby",
    blurb: "The editor and agents, on your own key.",
    monthly: 0,
    yearlyMonthly: 0,
    hostedTurns: 50,
    byokSlots: 1,
    tab: false,
    tabDaily: 0,
    backgroundJobs: 0,
    sandboxRuns: 0,
    acp: false,
    cta: "Start free",
    features: [
      "Composer, Chat, and Inline — not gated",
      "Plan before the first diff",
      "One send = one call on your key",
      "One bring-your-own key",
      "Session cap on by default",
      "Download a zip of the project",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    blurb: "More keys, Tab, and unlimited agents on your keys.",
    monthly: 20,
    yearlyMonthly: 16,
    hostedTurns: 500,
    byokSlots: 5,
    tab: true,
    tabDaily: 250,
    backgroundJobs: 1,
    sandboxRuns: 40,
    acp: true,
    featured: true,
    cta: "Activate Pro",
    features: [
      "Unlimited Composer on your GPT, Claude, Gemini, DeepSeek, Grok keys",
      "You pick the model. No Auto",
      "Tab ghost-text — fast model, on your key",
      "One background job",
      `ACP: ${acpAgentNames()} in the same diffs`,
    ],
  },
  {
    id: "team",
    name: "Team",
    blurb: "Headroom for people who live in the agent.",
    monthly: 40,
    yearlyMonthly: 32,
    hostedTurns: 2000,
    byokSlots: 5,
    tab: true,
    tabDaily: 600,
    backgroundJobs: 3,
    sandboxRuns: 150,
    acp: true,
    cta: "Activate Team",
    features: [
      "Everything in Pro",
      "Tab ghost-text on your key",
      "Three concurrent background jobs",
      "Usage dashboard and session caps",
    ],
  },
];

export const PROVIDERS: Array<{
  id: ProviderId;
  label: string;
  short: string;
  hint: string;
  placeholder: string;
}> = [
  { id: "grok", label: "xAI Grok", short: "Grok", hint: "api.x.ai", placeholder: "xai-…" },
  { id: "openai", label: "OpenAI GPT", short: "GPT", hint: "api.openai.com", placeholder: "sk-…" },
  { id: "anthropic", label: "Anthropic Claude", short: "Claude", hint: "api.anthropic.com", placeholder: "sk-ant-…" },
  { id: "gemini", label: "Google Gemini", short: "Gemini", hint: "aistudio.google.com", placeholder: "AIza…" },
  { id: "deepseek", label: "DeepSeek", short: "DeepSeek", hint: "api.deepseek.com", placeholder: "sk-…" },
];

export function planById(id: string): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0]!;
}

export function isProvider(value: string): value is ProviderId {
  return PROVIDERS.some((p) => p.id === value);
}

export function isModelSource(value: string): value is ModelSource {
  return value === "hosted" || value === "custom" || isProvider(value);
}

export function providerShort(id: ProviderId): string {
  return PROVIDERS.find((p) => p.id === id)?.short ?? id;
}

/**
 * Whether a plan can be chosen today. There is no checkout yet, so only the
 * free plan can; the paid plans show as coming soon.
 */
export function planAvailable(plan: Pick<Plan, "monthly">): boolean {
  return plan.monthly === 0;
}

/**
 * Why a plan change must be refused, or null when it may go ahead. The server
 * asks this, so a request made without the UI cannot pick a paid plan either.
 * With sign-in off every visitor shares one plan, and a paid plan there would
 * raise the demo's spending cap for everyone.
 */
export function planChangeRefusal(plan: Pick<Plan, "name" | "monthly">, signInOff: boolean): string | null {
  if (planAvailable(plan)) return null;
  if (signInOff) return `${plan.name} can't be chosen while sign-in is off.`;
  return `${plan.name} is not available yet: there is no checkout.`;
}

/**
 * Whether plans and prices are shown at all. With sign-in off (the public
 * demo) every visitor shares one plan, so a plan picker there would change it
 * for everyone. It shows none.
 */
export function pricingVisible(authEnabled: boolean): boolean {
  return authEnabled;
}
