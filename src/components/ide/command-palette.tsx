import { useEffect, useMemo, useState } from "react";
import { Command } from "cmdk";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeftRight, Bug, Clock, Download, Eye, FileArchive, FileCode, FolderOpen, Github, History, LayoutPanelLeft, Maximize2, Palette, PanelBottom, PanelRight, RotateCcw, Search, Sparkles, Undo2 } from "lucide-react";
import { useIdeUi } from "@/lib/ui-store";
import { useWorkspace } from "@/lib/workspace/store";
import { pickFolder, pickZip } from "@/lib/workspace/import-bridge";
import { downloadCurrentWorkspace } from "@/lib/workspace/download";
import { abortAgent } from "@/lib/agent/run";
import { parseGoto, resolveGotoPath } from "@/lib/editor/goto";
import { fuzzyMatch } from "@/lib/utils";

export function CommandPalette() {
  const open = useIdeUi((s) => s.commandOpen);
  const setCommandOpen = useIdeUi((s) => s.setCommandOpen);
  const setMobilePane = useIdeUi((s) => s.setMobilePane);
  const setGithubOpen = useIdeUi((s) => s.setGithubOpen);
  const setHistoryOpen = useIdeUi((s) => s.setHistoryOpen);
  const setDesignOpen = useIdeUi((s) => s.setDesignOpen);
  const designOpen = useIdeUi((s) => s.designOpen);
  const theme = useIdeUi((s) => s.theme);
  const density = useIdeUi((s) => s.density);
  const debug = useIdeUi((s) => s.debug);
  const setDebug = useIdeUi((s) => s.setDebug);
  const files = useWorkspace((s) => s.fileList);
  const openFile = useWorkspace((s) => s.openFile);
  const activePath = useWorkspace((s) => s.activePath);
  const loadDemo = useWorkspace((s) => s.loadDemo);
  const reindex = useWorkspace((s) => s.reindex);
  const checkpoints = useWorkspace((s) => s.checkpoints);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const paths = useMemo(
    () => files.filter((p) => fuzzyMatch(query, p)),
    [files, query],
  );
  const fileList = files;
  const goto = parseGoto(query);
  const gotoPath = goto ? resolveGotoPath(fileList, goto.path, activePath) : null;

  if (!open) return null;

  function close() {
    setCommandOpen(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh] max-md:items-stretch max-md:px-0 max-md:pt-0">
      <button
        type="button"
        aria-label="Close command palette"
        className="absolute inset-0 bg-bg/70"
        onClick={close}
      />
      <Command
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-float)] max-md:max-w-none max-md:rounded-none max-md:border-0"
        shouldFilter={false}
        loop
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-4 text-subtle" />
          <Command.Input
            // Ctrl+P is usually pressed with the cursor in the code: without
            // taking focus, the query was typed into the open file.
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="Go to file or run a command"
            className="h-12 w-full bg-transparent text-sm text-fg outline-none placeholder:text-subtle md:h-12"
          />
        </div>
        <Command.List className="aperture-scroll max-h-80 overflow-y-auto p-2 max-md:max-h-[min(70dvh,28rem)]">
          <Command.Empty className="px-3 py-6 text-center text-sm text-muted">No matches</Command.Empty>
          {goto && gotoPath && (
            <Command.Group heading="Go to" className="px-1 pb-2 text-[11px] text-subtle">
              <Command.Item
                value={`goto:${gotoPath}:${goto.line}`}
                onSelect={() => {
                  openFile(gotoPath);
                  useIdeUi.getState().setReveal({ path: gotoPath, line: goto.line });
                  setMobilePane("editor");
                  close();
                }}
                className="cmdk-item flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg max-md:min-h-11"
              >
                <Search className="size-3.5 text-subtle" />
                <span>
                  {gotoPath}:{goto.line}
                </span>
              </Command.Item>
            </Command.Group>
          )}
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
                className="cmdk-item flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg max-md:min-h-11"
              >
                <FileCode className="size-3.5 text-subtle" />
                <span className="font-mono text-[13px]">{path}</span>
              </Command.Item>
            ))}
          </Command.Group>
          <Command.Group heading="Workspace" className="px-1 text-[11px] text-subtle">
            <Command.Item
              onSelect={() => {
                useIdeUi.getState().requestFind();
                setMobilePane("editor");
                close();
              }}
              className="cmdk-item flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg"
            >
              <Search className="size-3.5 text-subtle" />
              Find in file
            </Command.Item>
            <Command.Item
              onSelect={() => {
                setDesignOpen(!designOpen);
                setMobilePane("editor");
                close();
              }}
              className="cmdk-item flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg"
            >
              <Eye className="size-3.5 text-subtle" />
              {designOpen ? "Close Preview" : "Preview"}
            </Command.Item>
            <Command.Item
              onSelect={() => {
                useIdeUi.getState().setTheme(theme === "claude" ? "cursor" : "claude");
                close();
              }}
              className="cmdk-item flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg"
            >
              <Palette className="size-3.5 text-subtle" />
              {theme === "claude" ? "Theme: Cool" : "Theme: Warm"}
            </Command.Item>
            <Command.Item
              onSelect={() => {
                useIdeUi.getState().setDensity(density === "compact" ? "comfortable" : "compact");
                close();
              }}
              className="cmdk-item flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg"
            >
              <Palette className="size-3.5 text-subtle" />
              Density: {density === "compact" ? "Comfortable" : "Compact"}
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
          <Command.Group heading="Layout" className="px-1 text-[11px] text-subtle">
            {(
              [
                ["right", PanelRight, "Preview beside the code"],
                ["bottom", PanelBottom, "Preview below the code"],
                ["full", Maximize2, "Preview in the full editor"],
              ] as const
            ).map(([dock, Icon, label]) => (
              <Command.Item
                key={dock}
                onSelect={() => {
                  useIdeUi.getState().setPreviewDock(dock);
                  setDesignOpen(true);
                  setMobilePane("editor");
                  close();
                }}
                className="cmdk-item flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg"
              >
                <Icon className="size-3.5 text-subtle" />
                {label}
              </Command.Item>
            ))}
            <Command.Item
              onSelect={() => {
                const ui = useIdeUi.getState();
                ui.setSwapSides(!ui.swapSides);
                close();
              }}
              className="cmdk-item flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg"
            >
              <ArrowLeftRight className="size-3.5 text-subtle" />
              Swap sidebars
            </Command.Item>
            <Command.Item
              onSelect={() => {
                useIdeUi.getState().resetLayout();
                close();
              }}
              className="cmdk-item flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg"
            >
              <LayoutPanelLeft className="size-3.5 text-subtle" />
              Reset layout
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
