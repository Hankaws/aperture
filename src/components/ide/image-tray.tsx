import { ImageIcon, Loader2, X } from "lucide-react";
import type { AgentImage } from "@/lib/agent/images";

const src = (image: AgentImage) => `data:${image.mediaType};base64,${image.data}`;

/** The images waiting to go with the next message, each with a way to take it off. */
export function ImageTray({
  images,
  busy,
  onRemove,
}: {
  images: AgentImage[];
  busy: boolean;
  onRemove: (index: number) => void;
}) {
  if (images.length === 0 && !busy) return null;
  return (
    <ul className="flex flex-wrap gap-2 px-2.5 pt-2" aria-label="Images to send">
      {images.map((image, index) => (
        <li key={`${image.name}-${index}`} className="group relative">
          <img
            src={src(image)}
            alt={image.name}
            title={image.name}
            className="size-14 rounded-md border border-border object-cover"
          />
          <button
            type="button"
            onClick={() => onRemove(index)}
            aria-label={`Remove ${image.name}`}
            className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full border border-border bg-elevated text-muted hover:text-fg"
          >
            <X className="size-3" />
          </button>
        </li>
      ))}
      {busy && (
        <li className="grid size-14 place-items-center rounded-md border border-dashed border-border text-subtle">
          <Loader2 className="size-4 animate-spin" aria-label="Preparing image" />
        </li>
      )}
    </ul>
  );
}

/** The images a message was sent with, in the thread; one no longer kept on this device shows its name. */
export function MessageImages({ images }: { images: AgentImage[] | undefined }) {
  const list = Array.isArray(images) ? images.filter((i) => i && typeof i.name === "string") : [];
  if (list.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {list.map((image, index) =>
        image.data ? (
          <li key={`${image.name}-${index}`}>
            <img
              src={src(image)}
              alt={image.name}
              title={image.name}
              className="max-h-40 max-w-full rounded-md border border-border object-contain"
            />
          </li>
        ) : (
          <li
            key={`${image.name}-${index}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-subtle"
            title="Older images are not kept on this device"
          >
            <ImageIcon className="size-3.5" aria-hidden />
            {image.name}
          </li>
        ),
      )}
    </ul>
  );
}
