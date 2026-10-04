import type { LineMark } from "./marks";
import { ED, SYN } from "./theme";

export function paintMinimap(
  host: HTMLElement,
  text: string,
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  marks: LineMark[] = [],
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
      `<i style="top:${(i * lineH).toFixed(2)}px;width:${width.toFixed(1)}px;height:${Math.max(1, lineH - 0.4).toFixed(2)}px;opacity:${comment ? 0.4 : 0.28};background:${comment ? SYN.comment : ED.fg}"></i>`,
    );
  }
  // A tick per marked line, at the line's place in the whole file, so problems below the fold show.
  const total = Math.max(lines.length, 1);
  const ticks = [...new Map(marks.map((mark) => [mark.line, mark])).values()].map((mark) => {
    const worst = marks.some((m) => m.line === mark.line && m.severity === "error") ? "error" : "warning";
    const top = Math.min(h - 3, ((mark.line - 1) / total) * h);
    return `<b class="aperture-minimap-mark" style="top:${top.toFixed(1)}px;background:${worst === "error" ? ED.squiggleError : ED.squiggleWarn}"></b>`;
  });
  const ratio = scrollHeight > 0 ? clientHeight / scrollHeight : 1;
  const top = scrollHeight > 0 ? (scrollTop / scrollHeight) * h : 0;
  const sliderH = Math.max(12, h * ratio);
  host.innerHTML = `<span class="aperture-minimap-slider" style="top:${top.toFixed(1)}px;height:${sliderH.toFixed(1)}px"></span>${bars.join("")}${ticks.join("")}`;
}

export function minimapScrollTo(host: HTMLElement, clientY: number, scrollHeight: number): number {
  const rect = host.getBoundingClientRect();
  const y = Math.min(Math.max(clientY - rect.top, 0), rect.height);
  const ratio = rect.height > 0 ? y / rect.height : 0;
  return ratio * scrollHeight;
}
