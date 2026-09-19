export type EditorTheme = "cursor" | "claude";
export type Density = "compact" | "comfortable";

export const THEME_KEY = "aperture-theme";
export const DENSITY_KEY = "aperture-density";

export function readTheme(): EditorTheme {
  try {
    return localStorage.getItem(THEME_KEY) === "claude" ? "claude" : "cursor";
  } catch {
    return "cursor";
  }
}

export function readDensity(): Density {
  try {
    return localStorage.getItem(DENSITY_KEY) === "comfortable" ? "comfortable" : "compact";
  } catch {
    return "compact";
  }
}

export function applyAppearance(theme: EditorTheme, density: Density) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.density = density;
  try {
    localStorage.setItem(THEME_KEY, theme);
    localStorage.setItem(DENSITY_KEY, density);
  } catch {
    // quota
  }
}
