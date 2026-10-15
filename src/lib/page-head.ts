/**
 * One title and description per page. Without them every tab, history entry
 * and search result reads "Aperture: an AI code editor that checks its own
 * work": the root route's. The root's Open Graph tags are left alone.
 *
 * Titles read "<page> · Aperture", the page first so a row of tabs stays
 * readable. Kept in one table so a test can check that none repeat.
 */
export const SITE_NAME = "Aperture";

export type PageKey =
  | "app"
  | "editor"
  | "bot"
  | "botCheck"
  | "botAgents"
  | "benchmark"
  | "changelog"
  | "pricing"
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
  botCheck: {
    title: "Agent Check",
    description: "Run Aperture's checks on every pull request with one GitHub Action, with annotations on the lines that fail.",
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
  pricing: { title: "Pricing", description: "Aperture's plans. Nothing is charged today." },
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

/** The `head()` of a route: its own title and description. */
export function pageHead(key: PageKey) {
  return {
    meta: [
      { title: pageTitle(key) },
      { name: "description", content: PAGES[key].description },
    ],
  };
}
