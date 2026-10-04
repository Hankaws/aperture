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

  const steps = [
    { n: "1", title: "Open a file", body: "Single-click previews it (italic tab). Double-click keeps it. Pin from the tab. Open a folder, zip, or GitHub from Open." },
    { n: "2", title: "Ask Composer", body: "Manual mode: Composer plans and waits — edit the steps if you like, click Build it, then Apply. Toggle Crew so Claude and GPT can split a confirmed build. Design Mode strips page scripts; click an element, add a note, send it here." },
    { n: "3", title: "Apply the diffs", body: "Green and red draw in the file. A failing check puts a dot in the margin: hover it for the message. Apply, reject, or undo the run." },
  ];

  const rows = [
    [`${mod}P`, "Go to file"],
    [`${mod}I`, "Focus Composer"],
    [`${mod}J`, "Agent board: every run, and compare two"],
    [`${mod}K`, "Inline edit on the selection"],
    [`${mod}Enter`, "Apply the change in this file"],
    ["F8", "Next review hunk · Shift previous · Alt next file"],
    ["F7", "Next check problem in the file · Shift previous"],
    ["/review /fix /explain", "Slash commands in Composer"],
    ["Tab", "Accept ghost text (Pro)"],
    [`${mod}→`, "Accept the next ghost word"],
    [`${mod}Space`, "Workspace symbols"],
    [`${mod}/`, "This guide"],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-bg/70" onClick={() => setOpen(false)} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-base font-medium">How this editor works</h2>
        <ol className="mt-4 space-y-3">
          {steps.map((step) => (
            <li key={step.n} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-md border border-border font-mono text-xs text-subtle">
                {step.n}
              </span>
              <div>
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-sm leading-relaxed text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Highlight code, then Explain or Fix. Ask never writes. Composer plans first, then waits for Build it.
        </p>
        <ul className="mt-5 space-y-2 border-t border-border pt-4">
          {rows.map(([key, label]) => (
            <li key={key} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted">{label}</span>
              <kbd className="rounded-md border border-border bg-bg px-2 py-1 font-mono text-xs text-fg">{key}</kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
