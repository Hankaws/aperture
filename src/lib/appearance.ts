/** `cursor` and `claude` are the cool and warm dark themes; `system` follows the OS. */
export type EditorTheme = "cursor" | "claude" | "light" | "system";
/** The theme a page is drawn in: `system` resolved to light or dark. */
export type ResolvedTheme = Exclude<EditorTheme, "system">;
export type Density = "compact" | "comfortable";

export const THEME_KEY = "aperture-theme";
export const DENSITY_KEY = "aperture-density";

const THEMES: readonly EditorTheme[] = ["cursor", "claude", "light", "system"];

export function parseTheme(value: string | null | undefined): EditorTheme {
  return THEMES.includes(value as EditorTheme) ? (value as EditorTheme) : "cursor";
}

export function resolveTheme(theme: EditorTheme, prefersLight: boolean): ResolvedTheme {
  if (theme !== "system") return theme;
  return prefersLight ? "light" : "cursor";
}

/**
 * The same choice before React loads, inlined into the document head so the
 * first paint is already in the right theme. Keep it in step with
 * `parseTheme` and `resolveTheme`.
 */
export const THEME_BOOT_SCRIPT =
  'try{var t=localStorage.getItem("aperture-theme");' +
  'if(t==="system")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"cursor";' +
  'if(t==="cursor"||t==="claude"||t==="light")document.documentElement.setAttribute("data-theme",t);' +
  'var d=localStorage.getItem("aperture-density");if(!d&&matchMedia("(pointer: coarse)").matches)d="comfortable";' +
  'if(d)document.documentElement.setAttribute("data-density",d);}catch(e){}';

export function readTheme(): EditorTheme {
  try {
    return parseTheme(localStorage.getItem(THEME_KEY));
  } catch {
    return "cursor";
  }
}

/** The stored choice; with none, comfortable on a touch screen (bigger targets) and compact elsewhere. */
export function readDensity(): Density {
  try {
    const stored = localStorage.getItem(DENSITY_KEY);
    if (stored === "comfortable" || stored === "compact") return stored;
  } catch {
    // Storage blocked: fall through to the device's default.
  }
  return defaultDensity(typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches);
}

export function defaultDensity(touch: boolean): Density {
  return touch ? "comfortable" : "compact";
}

const LIGHT_QUERY = "(prefers-color-scheme: light)";
let stopFollowing: (() => void) | null = null;

function prefersLight(): boolean {
  return typeof matchMedia === "function" && matchMedia(LIGHT_QUERY).matches;
}

export function applyAppearance(theme: EditorTheme, density: Density) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(theme, prefersLight());
  root.dataset.density = density;
  // `system` keeps following the OS while the page is open.
  stopFollowing?.();
  stopFollowing = null;
  if (theme === "system" && typeof matchMedia === "function") {
    const query = matchMedia(LIGHT_QUERY);
    const follow = () => {
      root.dataset.theme = resolveTheme("system", query.matches);
    };
    query.addEventListener("change", follow);
    stopFollowing = () => query.removeEventListener("change", follow);
  }
  try {
    localStorage.setItem(THEME_KEY, theme);
    localStorage.setItem(DENSITY_KEY, density);
  } catch {
    // quota
  }
}
