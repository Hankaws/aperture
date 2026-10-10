import { useState } from "react";
import { ShieldCheck, Hand } from "lucide-react";
import { saveBot } from "@/lib/bot/team.api";
import type { BotAllow, BotProfile } from "@/lib/bot/team";
import { cn } from "@/lib/utils";

const RULES: Array<{ id: BotAllow; label: string; detail: string; icon: typeof Hand }> = [
  {
    id: "ask",
    label: "Ask first",
    detail: "Every suggestion waits for you to send it.",
    icon: Hand,
  },
  {
    id: "checks",
    label: "Always allow checks",
    detail:
      "A check on a pull request sends itself: it only reports. Changes to code still wait for you.",
    icon: ShieldCheck,
  },
];

/** What a bot may send without asking: saved at once, with the bot, on every device. */
export function RulePicker({
  bot,
  onSaved,
}: {
  bot: BotProfile;
  onSaved: (bots: BotProfile[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(allow: BotAllow) {
    if (allow === bot.allow) return;
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
          allow,
        },
      });
      if (out.ok) onSaved(out.bots);
      else setError(out.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the rule.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="radiogroup" aria-label={`What ${bot.name} may send without asking`}>
      <div className="mt-1 grid gap-2">
        {RULES.map(({ id, label, detail, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={bot.allow === id}
            disabled={busy}
            onClick={() => void pick(id)}
            className={cn(
              "flex gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-60",
              bot.allow === id
                ? "border-accent/40 bg-accent/5"
                : "border-border hover:border-fg/20",
            )}
          >
            <Icon
              className={cn(
                "mt-0.5 size-4 shrink-0",
                bot.allow === id ? "text-accent" : "text-subtle",
              )}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{label}</span>
              <span className="block text-xs text-pretty text-muted">{detail}</span>
            </span>
          </button>
        ))}
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
