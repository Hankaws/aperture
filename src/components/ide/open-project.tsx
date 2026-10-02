import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FolderOpen, Github, LoaderCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { importGithubRepo, listGithubRepos, saveGithubToken, clearGithubAccount, githubStatus, type GithubRepoSummary } from "@/lib/github/api";
import { readGithubToken, writeGithubToken, clearGithubToken, type GithubSource } from "@/lib/github/roundtrip";
import { abortAgent } from "@/lib/agent/run";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { filesFromDataTransfer, importLocalFiles } from "@/lib/workspace/from-local";
import { registerImportHandlers } from "@/lib/workspace/import-bridge";
import type { ImportResult } from "@/lib/workspace/project-files";
import { useWorkspace } from "@/lib/workspace/store";
import { useIdeUi } from "@/lib/ui-store";
import { cn } from "@/lib/utils";

function applyImport(result: ImportResult, source?: GithubSource | null) {
  const count = Object.keys(result.files).length;
  if (count === 0) {
    toast.error("No text files found. Binaries and node_modules are skipped.");
    return;
  }
  abortAgent();
  useWorkspace.getState().loadProject(result.name, result.files, source ?? null);
  const extra = [
    result.skipped ? `${result.skipped} skipped` : null,
    result.truncated ? "hit the size cap" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  toast.success(`Opened ${result.name} · ${count} files${extra ? ` · ${extra}` : ""}`);
}

export function OpenProjectHost() {
  const folderRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const githubOpen = useIdeUi((s) => s.githubOpen);
  const setGithubOpen = useIdeUi((s) => s.setGithubOpen);

  useEffect(() => {
    const input = folderRef.current;
    if (input) input.setAttribute("webkitdirectory", "");
  }, []);

  useEffect(() => {
    return registerImportHandlers({
      pickFolder: () => folderRef.current?.click(),
      pickZip: () => zipRef.current?.click(),
    });
  }, []);

  async function onFileList(list: File[], name?: string) {
    if (list.length === 0) return;
    setBusy(true);
    try {
      const result = await importLocalFiles(list, name);
      applyImport(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open files");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    function onDragOver(e: DragEvent) {
      if (!e.dataTransfer?.types.includes("Files")) return;
      e.preventDefault();
      const overComposer = e.target instanceof Element && Boolean(e.target.closest("[data-drop='composer']"));
      setDragging(!overComposer);
    }
    function onDragLeave(e: DragEvent) {
      if (e.relatedTarget === null) setDragging(false);
    }
    function onDrop(e: DragEvent) {
      if (!e.dataTransfer) return;
      if (e.target instanceof Element && e.target.closest("[data-drop='composer']")) return;
      e.preventDefault();
      setDragging(false);
      void (async () => {
        setBusy(true);
        try {
          const files = await filesFromDataTransfer(e.dataTransfer!);
          await onFileList(files);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Drop failed");
        } finally {
          setBusy(false);
        }
      })();
    }
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  return (
    <>
      <input
        ref={folderRef}
        type="file"
        multiple
        className="hidden"
        suppressHydrationWarning
        onChange={(e) => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          e.target.value = "";
          void onFileList(files);
        }}
      />
      <input
        ref={zipRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        suppressHydrationWarning
        onChange={(e) => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          e.target.value = "";
          void onFileList(files);
        }}
      />
      {githubOpen && <GithubDialog onClose={() => setGithubOpen(false)} busy={busy} setBusy={setBusy} />}
      {(dragging || busy) && (
        <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-list-drop/80">
          <div className="rounded-2xl border border-border bg-surface px-6 py-5 text-center shadow-[var(--shadow-float)]">
            {busy ? (
              <LoaderCircle className="mx-auto size-5 animate-spin text-muted" />
            ) : (
              <FolderOpen className="mx-auto size-5 text-accent" />
            )}
            <p className="mt-3 text-sm font-medium">{busy ? "Indexing…" : "Drop a folder, files, or .zip"}</p>
            <p className="mt-1 text-[12px] text-muted">node_modules and binaries are skipped</p>
          </div>
        </div>
      )}
    </>
  );
}

function GithubDialog({
  onClose,
  busy,
  setBusy,
}: {
  onClose: () => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
}) {
  const { user, isPending } = useCurrentUserState();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [login, setLogin] = useState<string | null>(null);
  const [repos, setRepos] = useState<GithubRepoSummary[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    void (async () => {
      let status = await githubStatus();
      if (!status.connected) {
        const local = readGithubToken();
        if (local) {
          const saved = await saveGithubToken({ data: { token: local } });
          if (saved.ok) status = saved;
        }
      }
      if (cancel) return;
      setLogin(status.connected ? status.login : null);
      if (!status.connected) return;
      const listed = await listGithubRepos({ data: {} });
      if (!cancel && listed.ok) setRepos(listed.repos);
    })();
    return () => {
      cancel = true;
    };
  }, [user]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    if (!user) return;
    setError(null);
    setBusy(true);
    try {
      const result = await importGithubRepo({ data: { url, token: readGithubToken() ?? undefined } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      applyImport(result, result.source);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-bg/70" onClick={onClose} />
      <form
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="flex items-center gap-2">
          <Github className="size-4" />
          <h2 className="text-base font-medium">Open a GitHub repo</h2>
        </div>
        <p className="mt-1 text-sm text-muted">
          {login
            ? `Signed in to GitHub as ${login}. Private repos are in the list. Push and merge use this account.`
            : "Public repos open with the link. Connect GitHub to open a private repo and send changes back."}
        </p>
        {!isPending && !user ? (
          <div className="mt-4">
            <p className="text-sm text-muted">Sign in so imports count against your account, not a shared quota.</p>
            <Link to="/login" search={{ next: "/app" }} className={cn(buttonVariants({ size: "sm" }), "mt-3")}>
              Sign in
            </Link>
          </div>
        ) : (
          <>
            <Input
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="facebook/react or https://github.com/owner/repo"
              className="mt-4 font-mono text-[13px]"
            />
            {login ? (
              <div className="mt-3 flex items-center justify-between gap-2 text-[12px] text-muted">
                <span>GitHub is saved on this account, not in the project.</span>
                <button
                  type="button"
                  className="shrink-0 hover:text-fg"
                  onClick={() => {
                    void clearGithubAccount().then(() => {
                      clearGithubToken();
                      setLogin(null);
                      setRepos([]);
                    });
                  }}
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="mt-3 flex gap-2">
                <Input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="GitHub token, repo scope"
                  autoComplete="off"
                  className="font-mono text-[13px]"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={!token.trim()}
                  onClick={() => {
                    void (async () => {
                      const saved = await saveGithubToken({ data: { token } });
                      if (!saved.ok) {
                        setError(saved.error);
                        return;
                      }
                      writeGithubToken(token);
                      setToken("");
                      setLogin(saved.login);
                      setError(null);
                      const listed = await listGithubRepos({ data: {} });
                      if (listed.ok) setRepos(listed.repos);
                    })();
                  }}
                >
                  Connect
                </Button>
              </div>
            )}
            {repos.length > 0 && (
              <ul className="mt-3 max-h-36 overflow-y-auto rounded-md border border-border">
                {repos.map((repo) => (
                  <li key={repo.fullName}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left font-mono text-[12px] hover:bg-elevated"
                      onClick={() => setUrl(repo.fullName)}
                    >
                      <span className="truncate">{repo.fullName}</span>
                      {repo.private && <span className="shrink-0 text-subtle">private</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {error && <p className="mt-2 text-sm text-danger">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={onClose} type="button">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={busy || !url.trim()}>
                {busy ? "Opening…" : "Open repo"}
              </Button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
