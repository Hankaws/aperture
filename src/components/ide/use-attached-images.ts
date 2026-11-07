import { useState } from "react";
import { toast } from "sonner";
import { toAgentImage } from "@/lib/agent/image-resize";
import { MAX_IMAGES, MAX_IMAGES_CHARS, type AgentImage } from "@/lib/agent/images";

/**
 * The images attached to the next message in the agent panel: pasted,
 * dropped or picked, each made small enough to send (`image-resize.ts`).
 * Past MAX_IMAGES, or the turn's size, the rest are left out with a note.
 */
export function useAttachedImages() {
  const [images, setImages] = useState<AgentImage[]>([]);
  const [busy, setBusy] = useState(false);

  async function add(files: File[]) {
    if (files.length === 0) return;
    setBusy(true);
    try {
      const next = [...images];
      let total = next.reduce((n, image) => n + image.data.length, 0);
      for (const file of files) {
        if (next.length >= MAX_IMAGES) {
          toast.error(`Attach at most ${MAX_IMAGES} images to a message.`);
          break;
        }
        const name = file.name || "screenshot.png";
        const image = await toAgentImage(file, name);
        if ("error" in image) {
          toast.error(image.error);
          continue;
        }
        if (total + image.data.length > MAX_IMAGES_CHARS) {
          toast.error("Those images are too large together. Attach fewer.");
          break;
        }
        total += image.data.length;
        next.push(image);
      }
      setImages(next);
    } finally {
      setBusy(false);
    }
  }

  return {
    images,
    busy,
    add,
    remove: (index: number) => setImages((list) => list.filter((_, i) => i !== index)),
    clear: () => setImages([]),
  };
}
