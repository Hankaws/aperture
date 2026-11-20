import { useRef } from "react";
import { FileText, Paperclip, X } from "lucide-react";
import type { AgentImage } from "@/lib/agent/images";
import { ACCEPT } from "@/lib/bot/attachments";
import { ImageTray, MessageImages } from "@/components/ide/image-tray";
import type { Attachments } from "./use-attachments";

/** What waits to go with the next message, above its box: each with a way to take it off. */
export function AttachTray({ att }: { att: Attachments }) {
  return (
    <>
      <ImageTray images={att.images} busy={att.busy} onRemove={att.removeImage} />
      {att.files.length > 0 && (
        <ul className="flex flex-wrap gap-2 px-2.5 pt-2" aria-label="Files to send">
          {att.files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-surface py-1 pr-1 pl-2 text-xs"
            >
              <FileText className="size-3.5 shrink-0 text-subtle" aria-hidden />
              <span className="truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => att.removeFile(i)}
                aria-label={`Remove ${file.name}`}
                className="grid size-5 place-items-center rounded text-subtle hover:text-fg"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** The paperclip beside a chat's box: pick pictures and text files. */
export function AttachButton({ att, disabled }: { att: Attachments; disabled?: boolean }) {
  const picker = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={picker}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(event) => {
          const list = [...(event.target.files ?? [])];
          event.target.value = "";
          void att.attach(list);
        }}
      />
      <button
        type="button"
        onClick={() => picker.current?.click()}
        disabled={disabled}
        aria-label="Attach a picture or file"
        title="Attach a picture or a text file. You can also paste or drop one here."
        className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-elevated hover:text-fg disabled:opacity-40"
      >
        <Paperclip className="size-4" />
      </button>
    </>
  );
}

/** What a message came with, in the thread: its pictures this visit, and the names of the rest. */
export function SentAttachments({
  pictures,
  names,
}: {
  pictures: AgentImage[] | undefined;
  names: string[] | undefined;
}) {
  const rest = (names ?? []).filter((n) => !pictures?.some((p) => p.name === n));
  return (
    <>
      {pictures && pictures.length > 0 && (
        <div className="max-w-[85%]">
          <MessageImages images={pictures} />
        </div>
      )}
      {rest.length > 0 && (
        <ul className="flex max-w-[85%] flex-wrap justify-end gap-1.5" aria-label="Attached">
          {rest.map((f, i) => (
            <li
              key={`${f}-${i}`}
              className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-xs text-muted"
            >
              <Paperclip className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{f}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
