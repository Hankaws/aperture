import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace/store";

export function Breadcrumbs() {
  const path = useWorkspace((s) => s.activePath);
  if (!path) return null;
  const parts = path.split("/").filter(Boolean);

  function copy(value: string) {
    void navigator.clipboard.writeText(value).then(
      () => toast.success("Copied path"),
      () => toast.error("Could not copy"),
    );
  }

  return (
    <nav aria-label="Breadcrumb" className="flex h-6 shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-bg px-2.5 text-[11px]">
      {parts.map((part, i) => {
        const acc = parts.slice(0, i + 1).join("/");
        const last = i === parts.length - 1;
        return (
          <span key={acc} className="flex min-w-0 items-center gap-1">
            {i > 0 && <span className="text-subtle">/</span>}
            <button
              type="button"
              className={last ? "truncate font-medium text-fg" : "truncate text-muted hover:text-fg"}
              title={`Copy ${acc}`}
              onClick={() => copy(acc)}
            >
              {part}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
