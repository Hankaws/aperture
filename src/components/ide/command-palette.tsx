import { useEffect, useMemo, useState } from "react";
import { Command } from "cmdk";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Bug, Clock, Download, FileArchive, FileCode, FolderOpen, Github, History, Palette, RotateCcw, Search, Sparkles, Undo2 } from "lucide-react";
import { useIdeUi } from "@/lib/ui-store";
import { useWorkspace } from "@/lib/workspace/store";
import { pickFolder, pickZip } from "@/lib/workspace/import-bridge";
import { downloadCurrentWorkspace } from "@/lib/workspace/download";
import { abortAgent } from "@/lib/agent/run";
import { fuzzyMatch } from "@/lib/utils";

export function CommandPalette() {
  const open = useIdeUi((s) => s.commandOpen);
  const setCommandOpen = useIdeUi((s) => s.setCommandOpen);
  const setMobilePane = useIdeUi((s) => s.setMobilePane);
  const setGithubOpen = useIdeUi((s) => s.setGithubOpen);
  const setHistoryOpen = useIdeUi((s) => s.setHistoryOpen);
  const debug = useIdeUi((s) => s.debug);
  const setDebug = useIdeUi((s) => s.setDebug);
  const files = useWorkspace((s) => s.files);
  const openFile = useWorkspace((s) => s.openFile);
  const loadDemo = useWorkspace((s) => s.loadDemo);
  const reindex = useWorkspace((s) => s.reindex);
  const checkpoints = useWorkspace((s) => s.checkpoints);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const paths = useMemo(
    () => Object.keys(files).filter((p) => fuzzyMatch(query, p)),
    [files, query],
  );

  if (!open) return null;

  function close() {
    setCommandOpen(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
      <button
        type="button"
        aria-label="Close command palette"
        className="absolute inset-0 bg-bg/70"
        onClick={close}
      />
      <Command
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-float)]"
        shouldFilter={false}
        loop
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-4 text-subtle" />
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder="Go to file or run a command"
            className="h-12 w-full bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
          />
        </div>
        <Command.List className="aperture-scroll max-h-80 overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-muted">No matches</Command.Empty>
          <Command.Group heading="Files" className="px-1 pb-2 text-[11px] text-subtle">
            {paths.slice(0, 12).map((path) => (
              <Command.Item
                key={path}
                value={path}
                onSelect={() => {
                  openFile(path);
                  setMobilePane("editor");
                  close();
                }}
                className="cmdk-item flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg"
              >
                <FileCode className="size-3.5 text-subtle" />
                <span className="font-mono text-[13px]">{path}</span>
              </Command.Item>
            ))}
          </Command.Group>
          <Command.Group heading="Workspace" className="px-1 text-[11px] text-subtle">
            <Command.Item
              onSelect={() => {
                close();
                window.location.assign("/theme.html");
              }}
              className="cmdk-item flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg"
            >
              <Palette className="size-3.5 text-subtle" />
              Editor theme
            </Command.Item>
            <Command.Item
              onSelect={() => {
                close();
                pickFolder();
              }}
              className="cmdk-item flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg"
            >
              <FolderOpen className="size-3.5 text-subtle" />
              Open folder
            </Command.Item>
            <Command.Item
              onSelect={() => {
                close();
                pickZip();
              }}
              className="cmdk-item flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg"
            >
              <FileArchive className="size-3.5 text-subtle" />
              Open zip
            </Command.Item>
            <Command.Item
              onSelect={() => {
                close();
                setGithubOpen(true);
              }}
              className="cmdk-item flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg"
            >
              <Github className="size-3.5 text-subtle" />
              Open GitHub repo
            </Command.Item>
            <Command.Item
              onSelect={() => {
                close();
                void downloadCurrentWorkspace()
                  .then((r) => toast.success(`Downloaded ${r.name} · ${r.count} files`))
                  .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Could not download"));
              }}
              className="cmdk-item flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg"
            >
              <Download className="size-3.5 text-subtle" />
              Download zip
            </Command.Item>
            <Command.Item
              onSelect={() => {
                close();
                setHistoryOpen(true);
              }}
              className="cmdk-item flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg"
            >
              <History className="size-3.5 text-subtle" />
              File history
            </Command.Item>
            <Command.Item
              onSelect={() => {
                close();
                const ck = useWorkspace.getState().undoLast();
                if (ck) toast.success(`Undid “${ck.label}”`);
                else toast.error("Nothing to undo");
              }}
              className="cmdk-item flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg"
            >
              <Undo2 className="size-3.5 text-subtle" />
              {checkpoints.length > 0 ? `Undo last run · ${checkpoints[checkpoints.length - 1]!.label}` : "Undo last Composer run"}
            </Command.Item>
            <Command.Item
              onSelect={() => {
                close();
                void navigate({ to: "/settings", search: { tab: "limits" } });
              }}
              className="cmdk-item flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg"
            >
              <Clock className="size-3.5 text-subtle" />
              Session cap
            </Command.Item>
            <Command.Item
              onSelect={() => {
                reindex();
                close();
              }}
              className="cmdk-item flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg"
            >
              <Sparkles className="size-3.5 text-subtle" />
              Rebuild index
            </Command.Item>
            <Command.Item
              onSelect={() => {
                const next = !useIdeUi.getState().debug;
                setDebug(next);
                toast.message(next ? "Debug is on" : "Debug is off", {
                  description: next
                    ? "The next Agent turn stores the redacted prompt and response on that message."
                    : "Later turns will not attach a debug block.",
                });
                close();
              }}
              className="cmdk-item flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg"
            >
              <Bug className="size-3.5 text-subtle" />
              {debug ? "Turn debug off" : "Turn debug on"}
            </Command.Item>
            <Command.Item
              onSelect={() => {
                abortAgent();
                loadDemo();
                close();
              }}
              className="cmdk-item flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg"
            >
              <RotateCcw className="size-3.5 text-subtle" />
              Reset harbor-api demo
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
