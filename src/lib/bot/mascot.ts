/**
 * Aperture Bot's mascot: a lens with a face. Each bot wears one, picked from
 * a few bodies, faces and colours, and its face follows what the bot is doing
 * (thinking, working, done, stuck). Drawn as SVG markup from those choices
 * alone, never from text a person typed, so the same markup can be shown on
 * the page and turned into a PNG for a GitHub App's logo. Pure, for tests.
 */

export const MASCOT_COLORS = {
  violet: "#7C5CFF",
  blue: "#3B82F6",
  sky: "#0EA5E9",
  teal: "#14B8A6",
  green: "#22A55B",
  lime: "#7DB51E",
  amber: "#E9A100",
  orange: "#F2711C",
  rose: "#F43F5E",
  pink: "#E447A0",
} as const;
export type MascotColor = keyof typeof MASCOT_COLORS;
export const MASCOT_COLOR_NAMES = Object.keys(MASCOT_COLORS) as MascotColor[];

export const MASCOT_BODIES = ["lens", "iris", "squircle", "drop", "pebble"] as const;
export type MascotBody = (typeof MASCOT_BODIES)[number];

export const MASCOT_FACES = [
  "smile",
  "happy",
  "wink",
  "curious",
  "focused",
  "determined",
  "proud",
  "surprised",
  "sleepy",
  "worried",
] as const;
export type MascotFace = (typeof MASCOT_FACES)[number];

export type Mascot = { color: MascotColor; body: MascotBody; face: MascotFace };

/** What the bot is doing; anything but idle wears its own face. */
export type MascotMood = "idle" | "thinking" | "working" | "done" | "stuck";

export const DEFAULT_MASCOT: Mascot = { color: "violet", body: "lens", face: "smile" };

const pick = <T extends string>(list: readonly T[], value: unknown, fallback: T): T =>
  typeof value === "string" && (list as readonly string[]).includes(value)
    ? (value as T)
    : fallback;

/** A mascot from stored or sent data: anything unknown falls back to the default. */
export function mascotFrom(raw: unknown): Mascot {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    color: pick(MASCOT_COLOR_NAMES, r.color, DEFAULT_MASCOT.color),
    body: pick(MASCOT_BODIES, r.body, DEFAULT_MASCOT.body),
    face: pick(MASCOT_FACES, r.face, DEFAULT_MASCOT.face),
  };
}

/** The face the mascot shows for a mood. */
export function faceFor(mascot: Mascot, mood: MascotMood): MascotFace {
  switch (mood) {
    case "thinking":
      return "curious";
    case "working":
      return "focused";
    case "done":
      return "happy";
    case "stuck":
      return "worried";
    default:
      return mascot.face;
  }
}

function hash(text: string): number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ (ch.codePointAt(0) ?? 0), 16777619);
  return h >>> 0;
}

/** A mascot that follows from a seed (a name, an id): the same seed, the same mascot. */
export function mascotFor(seed: string): Mascot {
  const h = hash(seed);
  return {
    color: MASCOT_COLOR_NAMES[h % MASCOT_COLOR_NAMES.length]!,
    body: MASCOT_BODIES[(h >>> 8) % MASCOT_BODIES.length]!,
    face: (["smile", "happy", "wink", "curious", "proud"] as const)[(h >>> 16) % 5]!,
  };
}

/** Names a new bot is offered, all short and camera-flavoured. */
export const BOT_NAMES = [
  "Iris",
  "Patch",
  "Lumen",
  "Nova",
  "Pixel",
  "Shutter",
  "Focus",
  "Halo",
  "Echo",
  "Juno",
  "Prism",
  "Flash",
] as const;

/** The first offered name that no bot has yet, by seed order. */
export function suggestName(taken: string[], seed = 0): string {
  const used = new Set(taken.map((t) => t.trim().toLowerCase()));
  for (let i = 0; i < BOT_NAMES.length; i++) {
    const name = BOT_NAMES[(seed + i) % BOT_NAMES.length]!;
    if (!used.has(name.toLowerCase())) return name;
  }
  return `Bot ${taken.length + 1}`;
}

/** The colour moved towards white (amount > 0) or black (amount < 0), by 0..1. */
export function shade(hex: string, amount: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const target = amount > 0 ? 255 : 0;
  const t = Math.min(1, Math.abs(amount));
  const mix = (c: number) => Math.round(c + (target - c) * t);
  const [r, g, b] = [mix((n >> 16) & 255), mix((n >> 8) & 255), mix(n & 255)];
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const BODY: Record<MascotBody, string> = {
  lens: '<circle cx="32" cy="33" r="27"/>',
  iris: '<path d="M32 5.5 55.8 19.3V46.7L32 60.5 8.2 46.7V19.3Z" stroke-linejoin="round" stroke-width="5"/>',
  squircle: '<rect x="6.5" y="7.5" width="51" height="51" rx="19"/>',
  drop: '<path d="M32 4.5C39 14 57 24.5 57 39.5 57 52 46 60.5 32 60.5S7 52 7 39.5C7 24.5 25 14 32 4.5Z"/>',
  pebble: '<ellipse cx="32" cy="35" rx="28.5" ry="24.5"/>',
};

/** The Aperture blades, faint on the body; they turn while the bot works. */
const BLADES = Array.from({ length: 6 }, (_, k) => {
  const a = (k * Math.PI) / 3;
  const b = a + 0.95;
  const p = (r: number, t: number) =>
    `${(32 + r * Math.cos(t)).toFixed(1)} ${(33 + r * Math.sin(t)).toFixed(1)}`;
  return `M${p(25, a)}L${p(13, b)}`;
}).join("");

const INK = "#14121F";

type Eye = "open" | "up" | "arc" | "line" | "half" | "wide";

function eye(kind: Eye, cx: number, cy: number): string {
  switch (kind) {
    case "arc":
      return `<path d="M${cx - 4} ${cy + 1.5}Q${cx} ${cy - 4} ${cx + 4} ${cy + 1.5}" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/>`;
    case "line":
      return `<path d="M${cx - 4} ${cy + 1}H${cx + 4}" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>`;
    case "half":
      return `<path d="M${cx - 4.4} ${cy - 0.6}H${cx + 4.4}A4.4 4.6 0 0 1 ${cx - 4.4} ${cy - 0.6}Z" fill="#fff"/><circle cx="${cx + 0.4}" cy="${cy + 1.4}" r="2" fill="${INK}"/>`;
    case "wide":
      return `<ellipse cx="${cx}" cy="${cy}" rx="5" ry="6" fill="#fff"/><circle cx="${cx}" cy="${cy}" r="2.1" fill="${INK}"/>`;
    case "up":
      return `<ellipse cx="${cx}" cy="${cy}" rx="4.3" ry="5.1" fill="#fff"/><circle cx="${cx + 1.1}" cy="${cy - 1.8}" r="2.2" fill="${INK}"/><circle cx="${cx + 1.8}" cy="${cy - 2.6}" r="0.7" fill="#fff"/>`;
    default:
      return `<ellipse cx="${cx}" cy="${cy}" rx="4.3" ry="5.1" fill="#fff"/><circle cx="${cx + 0.6}" cy="${cy + 0.9}" r="2.3" fill="${INK}"/><circle cx="${cx + 1.3}" cy="${cy + 0.1}" r="0.75" fill="#fff"/>`;
  }
}

const MOUTH = {
  smile:
    '<path d="M26.5 41.5Q32 46.5 37.5 41.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>',
  grin: '<path d="M25.5 40.5H38.5Q38 48 32 48T25.5 40.5Z" fill="#fff"/>',
  flat: '<path d="M27.5 43.5H36.5" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>',
  o: `<ellipse cx="32" cy="44" rx="3.2" ry="3.8" fill="${INK}" stroke="#fff" stroke-width="2"/>`,
  small: '<circle cx="35" cy="43.5" r="1.9" fill="none" stroke="#fff" stroke-width="2"/>',
  smirk:
    '<path d="M27 42.5Q33 46.5 38 40.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>',
  wavy: '<path d="M26 44.5Q29 41.5 32 44.5T38 44.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>',
  sleepy:
    '<path d="M29.5 43.5Q32 45 34.5 43.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>',
} as const;

const BLUSH =
  '<ellipse cx="18.5" cy="39" rx="3.4" ry="2" fill="#fff" opacity=".28"/><ellipse cx="45.5" cy="39" rx="3.4" ry="2" fill="#fff" opacity=".28"/>';
const BROWS_DOWN =
  '<path d="M19 22.5 27 25.5M45 22.5 37 25.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>';
const BROWS_UP =
  '<path d="M19.5 25 27 22M44.5 25 37 22" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>';

const FACES: Record<MascotFace, { eyes: [Eye, Eye]; mouth: keyof typeof MOUTH; extra?: string }> = {
  smile: { eyes: ["open", "open"], mouth: "smile" },
  happy: { eyes: ["arc", "arc"], mouth: "grin", extra: BLUSH },
  wink: { eyes: ["open", "arc"], mouth: "smirk" },
  curious: { eyes: ["up", "up"], mouth: "small" },
  focused: { eyes: ["half", "half"], mouth: "flat" },
  determined: { eyes: ["half", "half"], mouth: "flat", extra: BROWS_DOWN },
  proud: { eyes: ["arc", "arc"], mouth: "smirk", extra: BLUSH },
  surprised: { eyes: ["wide", "wide"], mouth: "o" },
  sleepy: { eyes: ["line", "line"], mouth: "sleepy" },
  worried: { eyes: ["open", "open"], mouth: "wavy", extra: BROWS_UP },
};

/** Eyes that can blink: open ones. */
const BLINKS: Eye[] = ["open", "up", "wide"];

/**
 * The mascot as SVG markup. `id` keeps its gradient and clip apart from other
 * mascots on the page; `animate` adds the classes the page's CSS moves
 * (blinking, the blades turning while it works, a bob while it thinks).
 */
export function mascotSvg(
  mascot: Mascot,
  {
    mood = "idle",
    id = "m",
    animate = false,
  }: { mood?: MascotMood; id?: string; animate?: boolean } = {},
): string {
  const m = mascotFrom(mascot);
  const safeId = id.replace(/[^A-Za-z0-9_-]/g, "");
  const base = MASCOT_COLORS[m.color];
  const face = FACES[faceFor(m, mood)];
  const body = BODY[m.body];
  const fill = `url(#${safeId}-g)`;
  const cls = (name: string) => (animate ? ` class="${name}"` : "");
  const blink = face.eyes.every((e) => BLINKS.includes(e));
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">`,
    `<defs><linearGradient id="${safeId}-g" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0" stop-color="${shade(base, 0.22)}"/><stop offset="1" stop-color="${shade(base, -0.18)}"/>`,
    `</linearGradient><clipPath id="${safeId}-c">${body}</clipPath></defs>`,
    `<g${cls(mood === "thinking" ? "mascot-bob" : "")}>`,
    body.replace(/^<(\w+)/, `<$1 fill="${fill}" stroke="${fill}"`),
    `<g clip-path="url(#${safeId}-c)">`,
    `<g${cls(mood === "working" ? "mascot-turn" : "")} style="transform-origin:32px 33px">`,
    `<path d="${BLADES}" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".16"/></g>`,
    `<ellipse cx="20" cy="17" rx="6" ry="3.2" transform="rotate(-32 20 17)" fill="#fff" opacity=".3"/></g>`,
    face.extra ?? "",
    `<g${cls(blink ? "mascot-blink" : "")} style="transform-origin:32px 31px">`,
    eye(face.eyes[0], 24, 31),
    eye(face.eyes[1], 40, 31),
    `</g>`,
    MOUTH[face.mouth],
    `</g></svg>`,
  ].join("");
}
