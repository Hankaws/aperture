import { acpAgentNames } from "../acp/kinds.ts";

export type PlanId = "hobby" | "pro" | "team";
export type ProviderId = "grok" | "openai" | "anthropic" | "gemini" | "deepseek";
/** `local`: a model on the person's own machine, called from their browser (see agent/local-model.ts). */
export type ModelSource = "hosted" | "custom" | "local" | ProviderId;

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
  /** Sandbox verification runs per UTC month; 0 means the feature is off for this plan. */
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
    // Keys and Tab are the person's own: more of either costs the deployment nothing.
    byokSlots: 5,
    tab: true,
    tabDaily: 0,
    // A job is one Composer turn run in the background, and an ACP agent a Composer flavour
    // or the person's own endpoint: both on their key, at no cost a panel turn does not have.
    backgroundJobs: 1,
    sandboxRuns: 0,
    acp: true,
    cta: "Start free",
    features: [
      "Composer, Chat, and Inline — not gated",
      "Plan before the first diff",
      "One send = one call on your key",
      "Up to five bring-your-own keys",
      "Tab ghost-text — fast model, on your key",
      "Tests run free in your browser",
      "One background job",
      `ACP: ${acpAgentNames()} in the same diffs`,
      "Session cap on by default",
      "Download a zip of the project",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    blurb: "Everything in Hobby, and a server sandbox for tests that need real Node.",
    monthly: 20,
    yearlyMonthly: 16,
    hostedTurns: 500,
    byokSlots: 5,
    tab: true,
    tabDaily: 250,
    backgroundJobs: 1,
    // Sized so a month of the longest runs still costs less than the price (plans/020).
    sandboxRuns: 300,
    acp: true,
    featured: true,
    cta: "Get Pro",
    features: [
      "Unlimited Composer on your GPT, Claude, Gemini, DeepSeek, Grok keys",
      "You pick the model. No Auto",
      "Tests that need real Node run in a sandbox (300 a month)",
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
    sandboxRuns: 1000,
    acp: true,
    cta: "Get Team",
    features: [
      "Everything in Pro",
      "Tests that need real Node run in a sandbox (1,000 a month)",
      "Three concurrent background jobs",
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
  return value === "hosted" || value === "custom" || value === "local" || isProvider(value);
}

export function providerShort(id: ProviderId): string {
  return PROVIDERS.find((p) => p.id === id)?.short ?? id;
}

/**
 * Whether a plan can be had today: the free plan always, a paid one only when
 * this deployment's checkout is open (Paddle and the sandbox both configured).
 */
export function planAvailable(plan: Pick<Plan, "monthly">, checkoutOpen = false): boolean {
  return plan.monthly === 0 || checkoutOpen;
}

/**
 * Why switching straight to a plan must be refused, or null when it may go
 * ahead. A paid plan is never switched to: it comes from a payment that
 * Paddle confirms, so a request made without the UI cannot pick one. With
 * sign-in off every visitor shares one plan, which must never be a paid one.
 */
export function planChangeRefusal(plan: Pick<Plan, "name" | "monthly">, signInOff: boolean): string | null {
  if (plan.monthly === 0) return null;
  if (signInOff) return `${plan.name} can't be chosen while sign-in is off.`;
  return `${plan.name} is bought through checkout, not switched to here.`;
}

/**
 * Whether plans and prices are shown at all. With sign-in off (the public
 * demo) every visitor shares one plan, so a plan picker there would change it
 * for everyone. It shows none.
 */
export function pricingVisible(authEnabled: boolean): boolean {
  return authEnabled;
}
