export type MdBlock =
  | { type: "h"; level: 1 | 2 | 3; text: string }
  | { type: "p"; text: string }
  | { type: "code"; lang: string; text: string }
  | { type: "ul"; items: string[] }
  | { type: "quote"; text: string };

/** `# Title` to `### Title`. A paragraph stops only where one starts, so `#12 is fixed` stays text. */
const HEADING = /^(#{1,3})\s+(.+)$/;

export function parseMarkdown(src: string): MdBlock[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: MdBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i]!.startsWith("```")) {
        body.push(lines[i]!);
        i += 1;
      }
      if (i < lines.length) i += 1;
      out.push({ type: "code", lang, text: body.join("\n") });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      out.push({ type: "h", level: heading[1]!.length as 1 | 2 | 3, text: heading[2]!.trim() });
      i += 1;
      continue;
    }
    if (line.startsWith("> ")) {
      out.push({ type: "quote", text: line.slice(2) });
      i += 1;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\s*[-*]\s+/, ""));
        i += 1;
      }
      out.push({ type: "ul", items });
      continue;
    }
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !HEADING.test(lines[i]!) && !lines[i]!.startsWith("```") && !/^\s*[-*]\s+/.test(lines[i]!)) {
      para.push(lines[i]!);
      i += 1;
    }
    out.push({ type: "p", text: para.join(" ") });
  }
  return out;
}
