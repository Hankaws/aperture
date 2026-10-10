import { useState } from "react";
import { ChevronDown, Download, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { GithubRepoSummary } from "@/lib/github/api";
import {
  MASCOT_BODIES,
  MASCOT_COLORS,
  MASCOT_COLOR_NAMES,
  MASCOT_FACES,
  type Mascot,
  type MascotMood,
} from "@/lib/bot/mascot";
import { deleteBot, saveBot } from "@/lib/bot/team.api";
import { FOCUSES, NAME_MAX, PERSONALITY_MAX, type BotProfile } from "@/lib/bot/team";
import type { ModelChoice } from "@/lib/bot/team-models";
import { cn } from "@/lib/utils";
import { downloadMascot } from "@/lib/bot/mascot-png";
import { MascotAvatar } from "./mascot";
import { ModelPicker } from "./model-picker";
import { RulePicker } from "./rule-picker";

type Draft = { name: string; repo: string; mascot: Mascot; personality: string };

const label = "text-xs font-medium tracking-[0.12em] text-subtle uppercase";

function Choice({
  selected,
  onClick,
  title,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={selected}
      className={cn(
        "grid place-items-center rounded-xl border bg-elevated transition-colors hover:border-fg/30",
        selected ? "border-accent ring-2 ring-accent/30" : "border-border",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Body, face and colour, each a row of choices drawn as the mascot itself. */
export function MascotPicker({
  value,
  onChange,
}: {
  value: Mascot;
  onChange: (next: Mascot) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className={label}>Shape</p>
        <div className="mt-2 grid grid-cols-5 gap-2">
          {MASCOT_BODIES.map((body) => (
            <Choice
              key={body}
              selected={value.body === body}
              onClick={() => onChange({ ...value, body })}
              title={`Shape: ${body}`}
              className="h-12"
            >
              <MascotAvatar mascot={{ ...value, body }} size={30} />
            </Choice>
          ))}
        </div>
      </div>
      <div>
        <p className={label}>Expression</p>
        <div className="mt-2 grid grid-cols-5 gap-2">
          {MASCOT_FACES.map((face) => (
            <Choice
              key={face}
              selected={value.face === face}
              onClick={() => onChange({ ...value, face })}
              title={`Expression: ${face}`}
              className="h-12"
            >
              <MascotAvatar mascot={{ ...value, face }} size={30} />
            </Choice>
          ))}
        </div>
      </div>
      <div>
        <p className={label}>Colour</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {MASCOT_COLOR_NAMES.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange({ ...value, color })}
              title={`Colour: ${color}`}
              aria-label={`Colour: ${color}`}
              aria-pressed={value.color === color}
              className={cn(
                "size-8 rounded-full ring-offset-2 ring-offset-surface transition-transform hover:scale-110",
                value.color === color && "ring-2 ring-fg",
              )}
              style={{ background: MASCOT_COLORS[color] }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const MOODS: Array<{ mood: MascotMood; label: string }> = [
  { mood: "idle", label: "Idle" },
  { mood: "thinking", label: "Thinking" },
  { mood: "working", label: "Working" },
  { mood: "done", label: "Done" },
  { mood: "stuck", label: "Stuck" },
];

/** The mascot large, with how it looks in each mood. */
function Preview({ mascot, name }: { mascot: Mascot; name: string }) {
  const [mood, setMood] = useState<MascotMood>("idle");
  return (
    <div className="flex flex-col items-center rounded-2xl border border-border bg-elevated/50 p-4">
      <MascotAvatar mascot={mascot} mood={mood} size={104} label={name || "The bot"} />
      <div
        className="mt-3 flex flex-wrap justify-center gap-1"
        role="group"
        aria-label="Preview a mood"
      >
        {MOODS.map((m) => (
          <button
            key={m.mood}
            type="button"
            onClick={() => setMood(m.mood)}
            aria-pressed={mood === m.mood}
            className={cn(
              "h-7 rounded-full px-2.5 text-xs",
              mood === m.mood
                ? "bg-surface text-fg ring-1 ring-border"
                : "text-muted hover:text-fg",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function RepoSelect({
  repos,
  value,
  onChange,
}: {
  repos: GithubRepoSummary[];
  value: string;
  onChange: (repo: string) => void;
}) {
  const known = repos.some((r) => r.fullName === value);
  return (
    <span className="relative mt-1 block">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full appearance-none rounded-lg border border-border bg-elevated pr-10 pl-3 font-mono text-sm text-fg focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none"
      >
        {!known && value && <option value={value}>{value}</option>}
        {repos.map((r) => (
          <option key={r.fullName} value={r.fullName}>
            {r.fullName}
            {r.private ? " (private)" : ""}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-subtle" />
    </span>
  );
}

/** Name, repository, instructions and mascot: the fields a new bot and a profile share. */
function Fields({
  draft,
  setDraft,
  repos,
}: {
  draft: Draft;
  setDraft: (next: Draft) => void;
  repos: GithubRepoSummary[];
}) {
  return (
    <div className="space-y-5">
      <Preview mascot={draft.mascot} name={draft.name} />
      <label className="block">
        <span className={label}>Name</span>
        <Input
          value={draft.name}
          maxLength={NAME_MAX}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          className="mt-1"
        />
      </label>
      <label className="block">
        <span className={label}>Looks after</span>
        <RepoSelect
          repos={repos}
          value={draft.repo}
          onChange={(repo) => setDraft({ ...draft, repo })}
        />
      </label>
      <MascotPicker value={draft.mascot} onChange={(mascot) => setDraft({ ...draft, mascot })} />
      <label className="block">
        <span className={label}>How it works</span>
        <Textarea
          value={draft.personality}
          maxLength={PERSONALITY_MAX}
          rows={4}
          placeholder="What it should focus on, and how it should talk to you."
          onChange={(event) => setDraft({ ...draft, personality: event.target.value })}
          className="mt-1"
        />
        <span className="mt-2 flex flex-wrap gap-1.5">
          {FOCUSES.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setDraft({ ...draft, personality: f.personality })}
              className="h-7 rounded-full border border-border px-2.5 text-xs text-muted hover:border-fg/30 hover:text-fg"
            >
              {f.label}
            </button>
          ))}
        </span>
      </label>
    </div>
  );
}

/** A bot's profile: everything about it, saved together; and the way to remove it. */
export function ProfilePanel({
  bot,
  repos,
  choices,
  onSaved,
  onDeleted,
}: {
  bot: BotProfile;
  repos: GithubRepoSummary[];
  choices: ModelChoice[];
  onSaved: (bots: BotProfile[]) => void;
  onDeleted: (bots: BotProfile[]) => void;
}) {
  const initial: Draft = {
    name: bot.name,
    repo: bot.repo,
    mascot: bot.mascot,
    personality: bot.personality,
  };
  const [draft, setDraft] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const out = await saveBot({ data: { id: bot.id, ...draft } });
      if (out.ok) onSaved(out.bots);
      else setError(out.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      onDeleted(await deleteBot({ data: { id: bot.id } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the bot.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className={label}>Talks on</p>
        <ModelPicker bot={bot} choices={choices} onSaved={onSaved} className="mt-1 w-fit" />
        <p className="mt-1 text-xs text-subtle">
          Saved at once. Add keys for more models in Settings.
        </p>
      </div>
      <div id="bot-rule">
        <p className={label}>Rule</p>
        <RulePicker bot={bot} onSaved={onSaved} />
      </div>
      <Fields draft={draft} setDraft={setDraft} repos={repos} />
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={() => void save()}
          disabled={!dirty || busy || !draft.name.trim()}
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          Save
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void downloadMascot(draft.mascot, draft.name)}
        >
          <Download className="size-4" />
          Avatar PNG
        </Button>
      </div>
      <p className="text-xs text-pretty text-subtle">
        The PNG is the logo to upload for a GitHub App of your own, so the bot&apos;s comments carry
        this face (see Setup).
      </p>
      <div className="border-t border-border pt-4">
        {confirm ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">Remove {bot.name} and its conversation?</span>
            <Button size="sm" variant="outline" onClick={() => void remove()} disabled={busy}>
              Remove
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
              Keep
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>
            <Trash2 className="size-4" />
            Remove from the team
          </Button>
        )}
        <p className="mt-2 text-xs text-subtle">Removing a bot here changes nothing on GitHub.</p>
      </div>
    </div>
  );
}

/** A new bot: a name and a face offered, its repository, and how it works. */
export function NewBot({
  repos,
  first,
  start,
  onCreated,
}: {
  repos: GithubRepoSummary[];
  /** No bots yet: say so. */
  first: boolean;
  start: Draft;
  onCreated: (bot: BotProfile, bots: BotProfile[]) => void;
}) {
  const [draft, setDraft] = useState<Draft>(start);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const out = await saveBot({ data: draft });
      if (out.ok) onCreated(out.bot, out.bots);
      else setError(out.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not make the bot.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-5 px-4 py-6">
      <div>
        <h2 className="text-xl font-medium tracking-tight">
          {first ? "Make your first bot" : "A new bot for your team"}
        </h2>
        <p className="mt-1 text-sm text-pretty text-muted">
          Each bot looks after one repository: you talk it through, it suggests tasks, and Aperture
          Bot does them on GitHub. Give it a name and a face.
        </p>
      </div>
      <Fields draft={draft} setDraft={setDraft} repos={repos} />
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button onClick={() => void create()} disabled={busy || !draft.name.trim() || !draft.repo}>
        {busy && <Loader2 className="size-4 animate-spin" />}
        Make {draft.name.trim() || "the bot"}
      </Button>
    </div>
  );
}

/**
 * What a new bot asks first: what to focus on. The answer becomes how it
 * works, and can be changed in its profile.
 */
export function FocusCard({
  bot,
  onSaved,
}: {
  bot: BotProfile;
  onSaved: (bots: BotProfile[]) => void;
}) {
  const [own, setOwn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(personality: string) {
    if (!personality.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const out = await saveBot({
        data: { id: bot.id, name: bot.name, repo: bot.repo, mascot: bot.mascot, personality },
      });
      if (out.ok) onSaved(out.bots);
      else setError(out.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 w-full max-w-lg rounded-2xl border border-border bg-elevated/60 p-4 text-left">
      <p className="font-medium">What should I mostly help with?</p>
      <p className="mt-0.5 text-sm text-muted">
        Pick the closest; you can change it in my profile.
      </p>
      <ol className="mt-3 overflow-hidden rounded-xl border border-border">
        {FOCUSES.map((f, i) => (
          <li key={f.id} className="border-b border-border last:border-b-0">
            <button
              type="button"
              disabled={busy}
              onClick={() => void pick(f.personality)}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-sm hover:bg-surface disabled:opacity-60"
            >
              <span className="grid size-6 place-items-center rounded-md border border-border font-mono text-xs text-subtle">
                {String.fromCharCode(65 + i)}
              </span>
              {f.label}
            </button>
          </li>
        ))}
      </ol>
      <form
        className="mt-2"
        onSubmit={(event) => {
          event.preventDefault();
          void pick(own);
        }}
      >
        <Input
          value={own}
          onChange={(event) => setOwn(event.target.value)}
          maxLength={PERSONALITY_MAX}
          placeholder="Or say it in your own words, and press Enter"
          aria-label="What I should help with, in your own words"
          disabled={busy}
        />
      </form>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
