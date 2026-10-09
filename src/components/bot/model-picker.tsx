import { useState } from "react";
import { ChevronDown, Cpu } from "lucide-react";
import { saveBot } from "@/lib/bot/team.api";
import type { BotModel, BotProfile } from "@/lib/bot/team";
import { modelLabel, type ModelChoice } from "@/lib/bot/team-models";
import { cn } from "@/lib/utils";

/** Which model a bot talks on: saved with the bot, so it follows it to every device. */
export function ModelPicker({
  bot,
  choices,
  onSaved,
  className,
}: {
  bot: BotProfile;
  choices: ModelChoice[];
  onSaved: (bots: BotProfile[]) => void;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const known = choices.some((c) => c.id === bot.model);

  async function pick(model: BotModel) {
    setBusy(true);
    setError(null);
    try {
      const out = await saveBot({
        data: {
          id: bot.id,
          name: bot.name,
          repo: bot.repo,
          mascot: bot.mascot,
          personality: bot.personality,
          model,
        },
      });
      if (out.ok) onSaved(out.bots);
      else setError(out.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the model.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className={cn("relative block", className)} title={error ?? `${bot.name}'s model`}>
      <span className="sr-only">Model {bot.name} talks on</span>
      <Cpu className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle" />
      <select
        value={bot.model}
        disabled={busy}
        onChange={(event) => void pick(event.target.value as BotModel)}
        className={cn(
          "h-8 max-w-[11rem] appearance-none truncate rounded-full border bg-elevated pr-7 pl-7 text-xs text-fg focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none disabled:opacity-60",
          error ? "border-danger/50" : "border-border",
        )}
      >
        {!known && <option value={bot.model}>{modelLabel(choices, bot.model)}</option>}
        {choices.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-subtle" />
    </label>
  );
}
