/**
 * One title and description per page. Without them every tab, history entry
 * and search result reads "Aperture: an AI code editor that checks its own
 * work": the root route's. The root's Open Graph tags are left alone.
 *
 * Titles read "<page> · Aperture", the page first so a row of tabs stays
 * readable. Kept in one table so a test can check that none repeat.
 */
import { canonicalLink } from "./seo.ts";

export const SITE_NAME = "Aperture";

export type PageKey =
  | "app"
  | "editor"
  | "bot"
  | "chat"
  | "botCheck"
  | "check"
  | "botAgents"
  | "benchmark"
  | "changelog"
  | "pricing"
  | "pay"
  | "privacy"
  | "security"
  | "terms"
  | "login"
  | "settings"
  | "notFound";

export const PAGES: Record<PageKey, { title: string; description: string }> = {
  app: {
    title: "Editor",
    description: "The Aperture editor. Plan a change, see it staged, and read five checks on it before you press Apply.",
  },
  editor: {
    title: "What the editor knows",
    description: "The TypeScript compiler runs in your browser tab: hints, references and problems, one key each. Nothing is sent anywhere.",
  },
  bot: {
    title: "Bot",
    description: "Ask the Aperture bot for a change on a GitHub issue. It opens a pull request only when no check is red.",
  },
  chat: {
    title: "Chat",
    description: "Your own bot, named by you: ask it anything, keep every chat, and nothing you say is posted anywhere.",
  },
  botCheck: {
    title: "Agent Check",
    description: "Run Aperture's checks on every pull request with one GitHub Action, with annotations on the lines that fail.",
  },
  check: {
    title: "Check a pull request",
    description: "Paste any public GitHub pull request and see Aperture's checks on it: imports, keys, switched-off tests and the project's own rules. No sign-in, nothing installed.",
  },
  botAgents: {
    title: "Connect an agent",
    description: "Give your own coding agent Aperture's checks over MCP. Make a token, add one line to the agent, call check_change.",
  },
  benchmark: {
    title: "Benchmark",
    description: "How often Aperture's checks stop a bad edit, with the full list of what they caught and what they missed.",
  },
  changelog: { title: "Changelog", description: "What changed in Aperture, version by version." },
  pricing: {
    title: "Pricing",
    description: "Aperture's plans. Hobby is free; Pro and Team add a server sandbox for tests that need real Node.",
  },
  pay: { title: "Checkout", description: "Pay for an Aperture plan through Paddle." },
  privacy: {
    title: "Privacy",
    description: "What leaves your browser when you use Aperture, and what does not.",
  },
  security: { title: "Security", description: "How Aperture handles your code, your model keys and its checks." },
  terms: { title: "Terms", description: "The rules for using Aperture, and what you agree to when you sign in." },
  login: { title: "Sign in", description: "Sign in to Aperture to send to a model and save your project. The demo editor needs no account." },
  settings: { title: "Settings", description: "Your plan, model keys, limits and agent tokens." },
  notFound: { title: "Page not found", description: "There is no page at this address. Go to the Aperture home page or open the editor." },
};

export function pageTitle(key: PageKey): string {
  return `${PAGES[key].title} · ${SITE_NAME}`;
}

/** Pages that search engines may list, with the one address each answers to. */
export const CANONICAL_PATH: Partial<Record<PageKey, string>> = {
  app: "/app",
  editor: "/editor",
  bot: "/bot",
  botCheck: "/bot?tab=check",
  botAgents: "/bot?tab=agents",
  check: "/check",
  benchmark: "/benchmark",
  changelog: "/changelog",
  pricing: "/pricing",
  privacy: "/privacy",
  security: "/security",
  terms: "/terms",
};

/** The `head()` of a route: its own title, description and canonical address. */
export function pageHead(key: PageKey) {
  const path = CANONICAL_PATH[key];
  return {
    meta: [
      { title: pageTitle(key) },
      { name: "description", content: PAGES[key].description },
    ],
    links: path ? [canonicalLink(path)] : [],
  };
}
