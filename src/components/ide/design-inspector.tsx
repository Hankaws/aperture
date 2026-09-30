import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { RotateCcw, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace/store";
import type { DesignCapture } from "@/lib/workspace/design-mode";
import {
  THEME_PRESETS,
  findRule,
  newRuleSelector,
  normalizeSelector,
  parseComputed,
  pickTargetRule,
  presetValues,
  readTokens,
  ruleValues,
  setDeclarations,
  setTokens,
  toHex,
  tokenRef,
  type DesignToken,
} from "@/lib/workspace/design-styles";

/**
 * Writes design edits straight to the project's files, the way a design tool
 * does: the preview hot-reloads the CSS at once. The first write of a session
 * takes one checkpoint, so Undo (here, or Undo last) puts everything back.
 */
function useDesignWriter(sessionKey: string, paths: string[], label: string) {
  const checkpoint = useRef<{ key: string; id: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    checkpoint.current = null;
    setDirty(false);
  }, [sessionKey]);

  function write(path: string, next: string) {
    const ws = useWorkspace.getState();
    if (ws.files[path] === next) return;
    if (checkpoint.current?.key !== sessionKey) {
      checkpoint.current = {
        key: sessionKey,
        id: ws.checkpointFiles([...new Set([...paths, path])], label),
      };
    }
    ws.writeFile(path, next);
    setDirty(true);
  }

  function undo() {
    const id = checkpoint.current?.id;
    if (!id) return;
    useWorkspace.getState().undoCheckpoint(id);
    checkpoint.current = null;
    setDirty(false);
    toast.success("Design changes undone");
  }

  return { write, undo, dirty };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-[11px] font-medium uppercase tracking-wide text-subtle">{title}</h4>
      <div className="grid grid-cols-1 gap-2 @sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  declared,
  onReset,
  children,
}: {
  label: string;
  declared: boolean;
  onReset?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center gap-1">
        <span className="text-[11px] text-muted">{label}</span>
        {declared && onReset && (
          <button
            type="button"
            onClick={onReset}
            title={`Remove ${label.toLowerCase()} from this rule`}
            aria-label={`Reset ${label.toLowerCase()}`}
            className="grid size-4 place-items-center rounded text-subtle hover:text-fg"
          >
            <RotateCcw className="size-3" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

const inputClass =
  "h-7 w-full min-w-0 rounded-md border border-border bg-bg px-2 font-mono text-[12px] text-fg placeholder:text-subtle focus:border-accent/60 focus:outline-none";

/** A text box that commits on Enter or blur, so typing "1" on the way to "16px" writes nothing. */
function TextValue({
  value,
  placeholder,
  onCommit,
  label,
}: {
  value: string;
  placeholder?: string;
  onCommit: (v: string) => void;
  label: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      aria-label={label}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft.trim() !== value && onCommit(draft.trim())}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onCommit(draft.trim());
        } else if (e.key === "Escape") {
          e.stopPropagation();
          setDraft(value);
        }
      }}
      className={inputClass}
    />
  );
}

/** A colour: the picker, the value as text, and the page's colour tokens one click away. */
function ColorValue({
  label,
  value,
  fallback,
  tokens,
  tokenValues,
  onChange,
}: {
  label: string;
  value: string;
  fallback: string;
  tokens: DesignToken[];
  tokenValues: Record<string, string>;
  onChange: (v: string) => void;
}) {
  const ref = tokenRef(value);
  const shown = ref ? (tokenValues[ref] ?? fallback) : value || fallback;
  const hex = toHex(shown) ?? "#000000";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          aria-label={`${label} colour`}
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-9 shrink-0 cursor-pointer rounded-md border border-border bg-bg p-0.5"
        />
        <TextValue label={label} value={value} placeholder={fallback} onCommit={onChange} />
      </div>
      {tokens.length > 0 && (
        <div
          className="flex flex-wrap gap-1"
          role="group"
          aria-label={`${label} from the design tokens`}
        >
          {tokens.map((t) => (
            <button
              key={t.name}
              type="button"
              title={`${t.name}: ${t.value}`}
              aria-label={`Use ${t.name}`}
              aria-pressed={ref === t.name}
              onClick={() => onChange(`var(${t.name})`)}
              className={cn(
                "size-5 rounded-full border transition-transform hover:scale-110",
                ref === t.name ? "border-accent ring-2 ring-accent/40" : "border-border",
              )}
              style={{ background: t.value }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <div
      className="flex h-7 rounded-md border border-border bg-bg p-0.5"
      role="group"
      aria-label={label}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded px-1.5 text-[11px] transition-colors",
            value === o.value ? "bg-elevated text-fg" : "text-subtle hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

type Target = { path: string; selector: string; exists: boolean };

/**
 * Restyles a picked element by editing the CSS rule behind it. The rule is
 * the one that names the element's own class (or id), in the stylesheet that
 * declares it; the person can pick another matching rule, or a new one.
 */
export function StyleInspector({
  capture,
  pageCss,
}: {
  capture: DesignCapture;
  pageCss: string[];
}) {
  const files = useWorkspace((s) => s.files);
  const classes = capture.classes ?? [];
  const id = capture.elementId ?? null;
  const rules = useMemo(
    () =>
      (capture.rules ?? []).filter((r) => files[r.from] !== undefined && /\.css$/i.test(r.from)),
    [capture.rules, files],
  );
  const fresh = newRuleSelector(capture.tag, classes, id, capture.scope ?? null);
  const home = pageCss.find((p) => files[p] !== undefined) ?? null;
  const options = useMemo(() => {
    const list: Target[] = [];
    const seen = new Set<string>();
    for (const r of [...rules].reverse()) {
      const key = `${r.from}|${normalizeSelector(r.selector)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({ path: r.from, selector: r.selector, exists: true });
    }
    if (
      home &&
      !list.some(
        (t) => t.path === home && normalizeSelector(t.selector) === normalizeSelector(fresh),
      )
    ) {
      list.push({ path: home, selector: fresh, exists: false });
    }
    return list;
  }, [rules, home, fresh]);
  const preferred = pickTargetRule(rules, classes, id, capture.tag);
  const [choice, setChoice] = useState<string | null>(null);
  useEffect(() => setChoice(null), [capture.id]);
  const target =
    options.find((t) => `${t.path}|${t.selector}` === choice) ??
    options.find(
      (t) => preferred && t.path === preferred.from && t.selector === preferred.selector,
    ) ??
    // Nothing styles this element on its own: a new rule, rather than a broad one like `*`.
    options.find((t) => !t.exists) ??
    options[0] ??
    null;
  const { write, undo, dirty } = useDesignWriter(
    `${capture.id}|${target?.path ?? ""}`,
    target ? [target.path] : [],
    `Design: ${capture.selector}`,
  );

  const tokens = useMemo(
    () => pageCss.flatMap((p) => (files[p] !== undefined ? readTokens(files[p]!) : [])),
    [pageCss, files],
  );
  const colorTokens = tokens.filter((t) => t.kind === "color");
  const tokenValues = Object.fromEntries(tokens.map((t) => [t.name, t.value]));
  const computed = useMemo(() => parseComputed(capture.css), [capture.css]);

  if (!target) {
    return (
      <p className="text-[13px] leading-relaxed text-muted">
        This page has no stylesheet file to edit. Link one with{" "}
        <code className="font-mono text-[12px]">&lt;link rel="stylesheet" href="…"&gt;</code>, then
        pick the element again.
      </p>
    );
  }

  const css = files[target.path] ?? "";
  const declared = ruleValues(findRule(css, target.selector));
  const value = (prop: string) => declared[prop] ?? "";
  const set = (prop: string, v: string | null) =>
    write(target.path, setDeclarations(css, target.selector, { [prop]: v }));
  const reset = (prop: string) =>
    declared[prop] !== undefined ? () => set(prop, null) : undefined;
  const px = (prop: string) => (computed[prop] ?? "").split(" ")[0] ?? "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-[11px] text-muted">Rule</span>
          <select
            value={`${target.path}|${target.selector}`}
            onChange={(e) => setChoice(e.target.value)}
            className="h-7 min-w-0 flex-1 rounded-md border border-border bg-bg px-2 font-mono text-[11px] text-fg"
            aria-label="CSS rule to edit"
          >
            {options.map((t) => (
              <option key={`${t.path}|${t.selector}`} value={`${t.path}|${t.selector}`}>
                {t.exists || findRule(files[t.path] ?? "", t.selector) ? "" : "New: "}
                {t.selector} · {t.path}
              </option>
            ))}
          </select>
        </label>
        {dirty && (
          <button
            type="button"
            onClick={undo}
            className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-border px-2 text-[11px] text-muted hover:text-fg"
          >
            <Undo2 className="size-3.5" />
            Undo changes
          </button>
        )}
      </div>
      {!target.exists && !findRule(css, target.selector) && (
        <p className="text-[11px] leading-relaxed text-subtle">
          No rule styles this element yet. The first change adds{" "}
          <code className="font-mono">{target.selector}</code> to {target.path}.
        </p>
      )}

      <Section title="Text">
        <Field label="Colour" declared={declared.color !== undefined} onReset={reset("color")}>
          <ColorValue
            label="Text"
            value={value("color")}
            fallback={computed.color ?? ""}
            tokens={colorTokens}
            tokenValues={tokenValues}
            onChange={(v) => set("color", v)}
          />
        </Field>
        <div className="space-y-2">
          <Field
            label="Size"
            declared={declared["font-size"] !== undefined}
            onReset={reset("font-size")}
          >
            <TextValue
              label="Font size"
              value={value("font-size")}
              placeholder={computed["font-size"]}
              onCommit={(v) => set("font-size", v || null)}
            />
          </Field>
          <Field
            label="Weight"
            declared={declared["font-weight"] !== undefined}
            onReset={reset("font-weight")}
          >
            <Segmented
              label="Font weight"
              value={value("font-weight") || computed["font-weight"] || ""}
              options={[
                { value: "400", label: "400" },
                { value: "500", label: "500" },
                { value: "600", label: "600" },
                { value: "700", label: "700" },
              ]}
              onChange={(v) => set("font-weight", v)}
            />
          </Field>
          <Field
            label="Align"
            declared={declared["text-align"] !== undefined}
            onReset={reset("text-align")}
          >
            <Segmented
              label="Text align"
              value={value("text-align") || computed["text-align"] || ""}
              options={[
                { value: "left", label: "Left" },
                { value: "center", label: "Center" },
                { value: "right", label: "Right" },
              ]}
              onChange={(v) => set("text-align", v)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Fill">
        <Field
          label="Background"
          declared={declared["background-color"] !== undefined || declared.background !== undefined}
          onReset={reset(declared.background !== undefined ? "background" : "background-color")}
        >
          <ColorValue
            label="Background"
            value={value("background-color") || value("background")}
            fallback={computed["background-color"] ?? ""}
            tokens={colorTokens}
            tokenValues={tokenValues}
            onChange={(v) => {
              // One property, not two that fight: replace a `background` shorthand when there is one.
              const prop = declared.background !== undefined ? "background" : "background-color";
              set(prop, v);
            }}
          />
        </Field>
        <Field
          label="Border colour"
          declared={declared["border-color"] !== undefined}
          onReset={reset("border-color")}
        >
          <ColorValue
            label="Border"
            value={value("border-color")}
            fallback={computed["border-color"] ?? ""}
            tokens={colorTokens}
            tokenValues={tokenValues}
            onChange={(v) => set("border-color", v)}
          />
        </Field>
      </Section>

      <Section title="Spacing and shape">
        <Field label="Padding" declared={declared.padding !== undefined} onReset={reset("padding")}>
          <TextValue
            label="Padding"
            value={value("padding")}
            placeholder={computed.padding}
            onCommit={(v) => set("padding", v || null)}
          />
        </Field>
        <Field label="Margin" declared={declared.margin !== undefined} onReset={reset("margin")}>
          <TextValue
            label="Margin"
            value={value("margin")}
            placeholder={computed.margin}
            onCommit={(v) => set("margin", v || null)}
          />
        </Field>
        <Field
          label="Corner radius"
          declared={declared["border-radius"] !== undefined}
          onReset={reset("border-radius")}
        >
          <TextValue
            label="Corner radius"
            value={value("border-radius")}
            placeholder={px("border-radius")}
            onCommit={(v) => set("border-radius", v || null)}
          />
        </Field>
        <Field label="Gap" declared={declared.gap !== undefined} onReset={reset("gap")}>
          <TextValue
            label="Gap"
            value={value("gap")}
            placeholder={computed.gap}
            onCommit={(v) => set("gap", v || null)}
          />
        </Field>
      </Section>
    </div>
  );
}

/**
 * The page's design tokens (`:root` custom properties), editable in place,
 * plus one-click themes that retune every colour token whose role the name
 * gives away (bg, surface, border, text, muted, accent).
 */
export function ThemePanel({ pageCss }: { pageCss: string[] }) {
  const files = useWorkspace((s) => s.files);
  const sheets = useMemo(
    () =>
      pageCss
        .filter((p) => files[p] !== undefined)
        .map((path) => ({ path, tokens: readTokens(files[path]!) }))
        .filter((s) => s.tokens.length > 0),
    [pageCss, files],
  );
  const { write, undo, dirty } = useDesignWriter(
    sheets.map((s) => s.path).join("|"),
    sheets.map((s) => s.path),
    "Design: theme",
  );

  if (sheets.length === 0) {
    return (
      <p className="text-[13px] leading-relaxed text-muted">
        No design tokens on this page yet. Declare them once in a stylesheet, for example{" "}
        <code className="font-mono text-[12px]">:root {"{ --accent: #3b9eff; }"}</code>, and use
        them with <code className="font-mono text-[12px]">var(--accent)</code>. They show up here to
        edit and theme.
      </p>
    );
  }

  const setToken = (path: string, name: string, v: string) => {
    if (!v) return;
    write(path, setTokens(useWorkspace.getState().files[path]!, { [name]: v }));
  };
  const applyPreset = (id: string) => {
    const preset = THEME_PRESETS.find((p) => p.id === id)!;
    let changed = 0;
    for (const s of sheets) {
      const values = presetValues(s.tokens, preset);
      changed += Object.keys(values).length;
      if (Object.keys(values).length)
        write(s.path, setTokens(useWorkspace.getState().files[s.path]!, values));
    }
    if (changed === 0)
      toast.error("None of these tokens is named for a colour role (bg, text, accent…)");
    else toast.success(`${preset.name} applied to ${changed} token${changed === 1 ? "" : "s"}`);
  };

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h4 className="text-[11px] font-medium uppercase tracking-wide text-subtle">Themes</h4>
          {dirty && (
            <button
              type="button"
              onClick={undo}
              className="ml-auto flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[11px] text-muted hover:text-fg"
            >
              <Undo2 className="size-3.5" />
              Undo changes
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 @md:grid-cols-5">
          {THEME_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.id)}
              className="rounded-lg border border-border p-2 text-left transition-colors hover:border-accent/50"
              style={{ background: p.colors.bg }}
            >
              <span className="flex gap-1">
                {(["surface", "border", "text", "accent"] as const).map((role) => (
                  <span
                    key={role}
                    className="size-3 rounded-full border border-black/10"
                    style={{ background: p.colors[role] }}
                  />
                ))}
              </span>
              <span
                className="mt-1.5 block text-[11px] font-medium"
                style={{ color: p.colors.text }}
              >
                {p.name}
              </span>
            </button>
          ))}
        </div>
      </section>
      {sheets.map((s) => (
        <section key={s.path} className="space-y-2">
          <h4 className="text-[11px] font-medium uppercase tracking-wide text-subtle">
            Tokens · <span className="font-mono normal-case">{s.path}</span>
          </h4>
          <ul className="space-y-1.5">
            {s.tokens.map((t) => (
              <li key={t.name} className="flex items-center gap-2">
                <span
                  className="w-28 shrink-0 truncate font-mono text-[12px] text-fg"
                  title={t.name}
                >
                  {t.name}
                </span>
                {t.kind === "color" && toHex(t.value) && (
                  <input
                    type="color"
                    aria-label={`${t.name} colour`}
                    value={toHex(t.value)!}
                    onChange={(e) => setToken(s.path, t.name, e.target.value)}
                    className="h-7 w-9 shrink-0 cursor-pointer rounded-md border border-border bg-bg p-0.5"
                  />
                )}
                <TextValue
                  label={t.name}
                  value={t.value}
                  onCommit={(v) => setToken(s.path, t.name, v)}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
