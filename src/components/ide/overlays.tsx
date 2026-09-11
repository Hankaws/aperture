import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIdeUi } from "@/lib/ui-store";
import { useWorkspace } from "@/lib/workspace/store";
import { modSymbol } from "@/lib/utils";

export function NewFileDialog() {
  const open = useIdeUi((s) => s.newFileOpen);
  const setOpen = useIdeUi((s) => s.setNewFileOpen);
  const createFile = useWorkspace((s) => s.createFile);
  const [path, setPath] = useState("src/");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-bg/70" onClick={() => setOpen(false)} />
      <form
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const clean = path.trim();
          if (!clean) return;
          createFile(clean, "");
          setOpen(false);
          setPath("src/");
        }}
      >
        <h2 className="text-base font-medium">New file</h2>
        <p className="mt-1 text-sm text-muted">Path is relative to the workspace root.</p>
        <Input
          autoFocus
          value={path}
          onChange={(e) => setPath(e.target.value)}
          className="mt-4 font-mono"
          placeholder="src/lib/new.ts"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" size="sm">
            Create
          </Button>
        </div>
      </form>
    </div>
  );
}

export function HelpDialog() {
  const open = useIdeUi((s) => s.helpOpen);
  const setOpen = useIdeUi((s) => s.setHelpOpen);
  const mod = modSymbol();
  if (!open) return null;

  const rows = [
    [`${mod}P`, "Go to file"],
    [`${mod}S`, "Download project zip"],
    [`${mod}K`, "Inline edit on the selection"],
    [`${mod}I`, "Focus Agent"],
    [`${mod}Enter`, "Apply staged diff in the editor"],
    ["Tab", "Accept ghost-text (Pro)"],
    [`${mod}B`, "Toggle file tree"],
    [`${mod}L`, "Toggle agent panel"],
    [`${mod}/`, "This cheat sheet"],
  ];

  const notes = [
    "Drop a folder, files, or .zip onto the editor to replace the workspace.",
    "Download a zip from Open, the command palette, or ⌘S / Ctrl+S. .env never goes in.",
    "Staged diffs draw in the open file. Apply there (Ctrl+Enter) or in chat. Undo this run restores the files from before that send.",
    "Highlight code, then Explain this or Fix this. Same chips sit above Composer.",
    "Open GitHub from the file tree — public repos, signed in.",
    "Type @ in Composer to attach a file or folder.",
    "Agent plans first, then waits. Click Build it to allow edits. Build now (next to send) skips the gate for a one-file fix. Ask never writes.",
    "Session cap is on by default. Raise it under Settings → Limits.",
    "Tab ghost-text is on Pro (fast model, daily hosted cap). Background jobs: 1 on Pro, 3 on Team.",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-bg/70" onClick={() => setOpen(false)} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-base font-medium">Shortcuts</h2>
        <ul className="mt-4 space-y-2">
          {rows.map(([key, label]) => (
            <li key={key} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted">{label}</span>
              <kbd className="rounded-md border border-border bg-bg px-2 py-1 font-mono text-[12px] text-fg">{key}</kbd>
            </li>
          ))}
        </ul>
        <ul className="mt-5 space-y-2 border-t border-border pt-4">
          {notes.map((note) => (
            <li key={note} className="text-[13px] leading-relaxed text-muted">
              {note}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
