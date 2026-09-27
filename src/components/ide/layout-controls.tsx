import * as Menu from "@radix-ui/react-dropdown-menu";
import {
  ArrowLeftRight,
  Check,
  Eye,
  LayoutPanelLeft,
  Maximize2,
  PanelBottom,
  PanelLeft,
  PanelRight,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import type { PreviewDock } from "@/lib/layout-prefs";
import { useIdeUi } from "@/lib/ui-store";
import { cn } from "@/lib/utils";

const DOCKS: { id: PreviewDock; label: string; icon: LucideIcon }[] = [
  { id: "right", label: "Beside the code", icon: PanelRight },
  { id: "bottom", label: "Below the code", icon: PanelBottom },
  { id: "full", label: "Full editor", icon: Maximize2 },
];

function Toggle({
  on,
  label,
  shortcut,
  icon: Icon,
  onClick,
}: {
  on: boolean;
  label: string;
  shortcut?: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={cn(
        "grid size-7 place-items-center rounded-md transition-colors",
        on ? "text-fg hover:bg-elevated" : "text-subtle hover:bg-elevated hover:text-muted",
      )}
    >
      <Icon className="size-4" strokeWidth={on ? 2 : 1.6} />
    </button>
  );
}

/** Show or hide the three work areas, like the panel toggles at the top right of VS Code and Cursor. */
export function PanelToggles({ mod }: { mod: string }) {
  const sidebarOpen = useIdeUi((s) => s.sidebarOpen);
  const chatOpen = useIdeUi((s) => s.chatOpen);
  const designOpen = useIdeUi((s) => s.designOpen);
  const swap = useIdeUi((s) => s.swapSides);
  const toggleSidebar = useIdeUi((s) => s.toggleSidebar);
  const toggleChat = useIdeUi((s) => s.toggleChat);
  const setDesignOpen = useIdeUi((s) => s.setDesignOpen);

  return (
    <div className="flex items-center" role="group" aria-label="Panels">
      <Toggle
        on={sidebarOpen}
        label="Files"
        shortcut={`${mod}B`}
        icon={swap ? PanelRight : PanelLeft}
        onClick={toggleSidebar}
      />
      <Toggle on={designOpen} label="Preview" icon={Eye} onClick={() => setDesignOpen(!designOpen)} />
      <Toggle
        on={chatOpen}
        label="Composer"
        shortcut={`${mod}L`}
        icon={swap ? PanelLeft : PanelRight}
        onClick={toggleChat}
      />
    </div>
  );
}

const itemClass =
  "flex h-8 cursor-pointer select-none items-center gap-2.5 rounded-md px-2 text-[13px] text-fg outline-none data-[highlighted]:bg-list-hover";

/** Move things around: where the preview docks and which side each sidebar sits on. */
export function LayoutMenu() {
  const dock = useIdeUi((s) => s.previewDock);
  const swap = useIdeUi((s) => s.swapSides);
  const setDock = useIdeUi((s) => s.setPreviewDock);
  const setSwap = useIdeUi((s) => s.setSwapSides);
  const setDesignOpen = useIdeUi((s) => s.setDesignOpen);
  const resetLayout = useIdeUi((s) => s.resetLayout);

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <button
          type="button"
          aria-label="Layout"
          title="Layout"
          className="grid size-7 place-items-center rounded-md text-subtle transition-colors hover:bg-elevated hover:text-fg data-[state=open]:bg-elevated data-[state=open]:text-fg"
        >
          <LayoutPanelLeft className="size-4" strokeWidth={1.6} />
        </button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={6}
          className="z-50 w-60 rounded-lg border border-border bg-elevated p-1 shadow-[var(--shadow-float)]"
        >
          <Menu.Label className="px-2 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-subtle">
            Preview
          </Menu.Label>
          <Menu.RadioGroup
            value={dock}
            onValueChange={(value) => {
              setDock(value as PreviewDock);
              setDesignOpen(true);
            }}
          >
            {DOCKS.map(({ id, label, icon: Icon }) => (
              <Menu.RadioItem key={id} value={id} className={itemClass}>
                <Icon className="size-4 text-subtle" strokeWidth={1.6} />
                <span className="flex-1">{label}</span>
                <Menu.ItemIndicator>
                  <Check className="size-3.5 text-accent" />
                </Menu.ItemIndicator>
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>
          <Menu.Separator className="my-1 h-px bg-border" />
          <Menu.Label className="px-2 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-subtle">
            Sidebars
          </Menu.Label>
          <Menu.RadioGroup value={swap ? "swap" : "default"} onValueChange={(value) => setSwap(value === "swap")}>
            <Menu.RadioItem value="default" className={itemClass}>
              <PanelLeft className="size-4 text-subtle" strokeWidth={1.6} />
              <span className="flex-1">Files left, Composer right</span>
              <Menu.ItemIndicator>
                <Check className="size-3.5 text-accent" />
              </Menu.ItemIndicator>
            </Menu.RadioItem>
            <Menu.RadioItem value="swap" className={itemClass}>
              <ArrowLeftRight className="size-4 text-subtle" strokeWidth={1.6} />
              <span className="flex-1">Files right, Composer left</span>
              <Menu.ItemIndicator>
                <Check className="size-3.5 text-accent" />
              </Menu.ItemIndicator>
            </Menu.RadioItem>
          </Menu.RadioGroup>
          <Menu.Separator className="my-1 h-px bg-border" />
          <Menu.Item className={itemClass} onSelect={resetLayout}>
            <RotateCcw className="size-4 text-subtle" strokeWidth={1.6} />
            Reset layout
          </Menu.Item>
          <p className="px-2 pb-1.5 pt-1 text-[11px] leading-snug text-subtle">
            Drag the lines between panels to resize. Sizes are remembered in this browser.
          </p>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
