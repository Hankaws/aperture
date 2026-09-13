import { parseMarkdown } from "@/lib/workspace/md-preview";

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("*") && part.endsWith("*")) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code key={i} className="rounded-sm bg-elevated px-1 font-mono text-[12px]">
              {part.slice(1, -1)}
            </code>
          );
        }
        const link = /^\[([^\]]+)\]\((https?:[^)]+)\)$/.exec(part);
        if (link) {
          return (
            <a key={i} href={link[2]} className="text-accent underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
              {link[1]}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export function MarkdownPreview({ text }: { text: string }) {
  const blocks = parseMarkdown(text);
  if (blocks.length === 0) {
    return <p className="px-6 py-8 text-sm text-subtle">Empty markdown.</p>;
  }
  return (
    <div className="aperture-scroll h-full overflow-auto px-6 py-4">
      {blocks.map((block, i) => {
        if (block.type === "h") {
          const Tag = block.level === 1 ? "h1" : block.level === 2 ? "h2" : "h3";
          return (
            <Tag
              key={i}
              className={
                block.level === 1
                  ? "mb-3 text-lg font-semibold text-fg"
                  : block.level === 2
                    ? "mb-2 mt-4 text-base font-semibold text-fg"
                    : "mb-2 mt-3 text-sm font-semibold text-fg"
              }
            >
              <Inline text={block.text} />
            </Tag>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={i} className="mb-3 list-disc space-y-1 pl-5 text-sm text-fg">
              {block.items.map((item, j) => (
                <li key={j}>
                  <Inline text={item} />
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === "code") {
          return (
            <pre key={i} className="aperture-scroll mb-3 overflow-auto rounded-lg border border-border bg-elevated p-3 font-mono text-[12px] leading-5 text-fg">
              {block.text}
            </pre>
          );
        }
        if (block.type === "quote") {
          return (
            <blockquote key={i} className="mb-3 border-l-2 border-accent pl-3 text-sm text-muted">
              <Inline text={block.text} />
            </blockquote>
          );
        }
        return (
          <p key={i} className="mb-3 text-sm leading-relaxed text-fg">
            <Inline text={block.text} />
          </p>
        );
      })}
    </div>
  );
}
