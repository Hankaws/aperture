/**
 * The models a bot of the team can talk on: the account's own choice, each
 * provider the person saved a key for, and their custom endpoint. A model in
 * the browser is not one: the chat runs on the server. Pure, for tests.
 */
import { PROVIDERS, providerShort, type ModelSource, type ProviderId } from "../billing/plans.ts";
import type { BotModel } from "./team.ts";

/** What the picker needs of the account (a slice of its snapshot). */
export type ModelAccount = {
  modelSource: ModelSource;
  keys: Record<ProviderId, { set: boolean }>;
  custom: { base: string | null; model: string | null };
};

export type ModelChoice = { id: BotModel; label: string };

function sourceLabel(account: ModelAccount, source: ModelSource): string {
  if (source === "hosted") return "Grok";
  if (source === "local") return "a local model";
  if (source === "custom") return account.custom.model || "your endpoint";
  return providerShort(source);
}

export function modelChoices(account: ModelAccount): ModelChoice[] {
  const choices: ModelChoice[] = [
    { id: "", label: `Default (${sourceLabel(account, account.modelSource)})` },
  ];
  for (const p of PROVIDERS)
    if (account.keys[p.id]?.set) choices.push({ id: p.id, label: p.short });
  if (account.custom.base && account.custom.model)
    choices.push({ id: "custom", label: account.custom.model });
  return choices;
}

/** How a bot's model reads where the choices do not have it (its key was removed). */
export function modelLabel(choices: ModelChoice[], model: BotModel): string {
  const found = choices.find((c) => c.id === model);
  if (found) return found.label;
  if (model === "custom") return "Custom endpoint (not set)";
  return model ? `${providerShort(model)} (no key)` : "Default";
}
