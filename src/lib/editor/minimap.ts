import { EDITOR } from "./theme";

export function paintMinimap(
  host: HTMLElement,
  text: string,
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
) {
  const h = host.clientHeight || 200;
  const w = host.clientWidth || 52;
  const lines = text.split("\n");
  const max = Math.min(lines.length, 900);
  const lineH = h / Math.max(max, 1);
  const bars: string[] = [];
  for (let i = 0; i < max; i += 1) {
    const t = (lines[i] ?? "").trim();
    if (!t) continue;
    const comment = t.startsWith("//") || t.startsWith("#") || t.startsWith("*");
    const width = Math.min(w - 8, Math.max(6, t.length * 1.15));
    bars.push(
      `<i style="top:${(i * lineH).toFixed(2)}px;width:${width.toFixed(1)}px;height:${Math.max(1, lineH - 0.4).toFixed(2)}px;opacity:${comment ? 0.4 : 0.28};background:${comment ? "#6d7080" : EDITOR.fg}"></i>`,
    );
  }
  const ratio = scrollHeight > 0 ? clientHeight / scrollHeight : 1;
  const top = scrollHeight > 0 ? (scrollTop / scrollHeight) * h : 0;
  const sliderH = Math.max(12, h * ratio);
  host.innerHTML = `<span class="aperture-minimap-slider" style="top:${top.toFixed(1)}px;height:${sliderH.toFixed(1)}px"></span>${bars.join("")}`;
}

export function minimapScrollTo(host: HTMLElement, clientY: number, scrollHeight: number): number {
  const rect = host.getBoundingClientRect();
  const y = Math.min(Math.max(clientY - rect.top, 0), rect.height);
  const ratio = rect.height > 0 ? y / rect.height : 0;
  return ratio * scrollHeight;
}
