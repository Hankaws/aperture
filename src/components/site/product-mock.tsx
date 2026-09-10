export function ProductMock() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-float)]">
      <div className="flex h-10 items-center gap-2 border-b border-border px-3">
        <span className="size-2 rounded-full bg-border" />
        <span className="size-2 rounded-full bg-border" />
        <span className="size-2 rounded-full bg-border" />
        <span className="ml-2 truncate font-mono text-[11px] text-subtle">harbor-api / src/store.ts</span>
        <span className="ml-auto hidden font-mono text-[11px] text-ok sm:inline">staged · 1 file</span>
      </div>
      <div className="grid min-h-[260px] md:grid-cols-[9.5rem_1fr_14rem]">
        <aside className="hidden border-r border-border p-3 font-mono text-[12px] text-muted md:block">
          <p className="mb-2 font-sans text-[10px] tracking-[0.14em] text-subtle uppercase">Workspace</p>
          <p className="text-fg">.aperture.md</p>
          <p>src</p>
          <p className="pl-3 text-fg">store.ts</p>
          <p className="pl-3">tasks.ts</p>
          <p className="pl-3">validate.ts</p>
          <p className="mt-3">package.json</p>
        </aside>
        <pre className="overflow-hidden p-4 font-mono text-[11px] leading-6 text-muted">
          <span className="text-subtle">24</span>  <span className="text-accent">export function</span> listTasks() {"{"}
          {"\n"}
          <span className="text-subtle">25</span>    const start = page * pageSize;{"\n"}
          <span className="text-ok">
            <span className="text-subtle">26</span>    return tasks.slice(start, start + pageSize);
          </span>
          {"\n"}
          <span className="text-subtle">27</span>  {"}"}
          {"\n"}
          <span className="text-subtle">28</span>
          {"\n"}
          <span className="text-subtle">29</span>  <span className="text-accent">export function</span> getTask(id: ID) {"{"}
          {"\n"}
          <span className="text-subtle">30</span>    const task = byId.get(id);{"\n"}
          <span className="text-danger">
            <span className="text-subtle">31</span>    return task;
          </span>
        </pre>
        <aside className="border-t border-border p-3 md:border-t-0 md:border-l">
          <p className="text-[11px] font-medium tracking-wide text-subtle uppercase">Claude Code</p>
          <p className="mt-2 text-[13px] leading-relaxed text-fg">Fix pagination in @src/store.ts</p>
          <div className="mt-3 rounded-lg border border-border bg-bg px-2 py-1.5">
            <p className="text-[10px] tracking-[0.14em] text-subtle uppercase">Plan</p>
            <p className="mt-1 text-[11px] text-ok">01 Read store.ts</p>
            <p className="text-[11px] text-accent">02 Patch listTasks slice</p>
            <p className="text-[11px] text-subtle">03 Stage the diff</p>
          </div>
          <p className="mt-2 font-mono text-[11px] text-subtle">Edit · src/store.ts</p>
          <p className="mt-3 text-[11px] text-muted">This run = 1 hosted turn · ACP</p>
        </aside>
      </div>
    </div>
  );
}
