import { useCallback, useState } from "react";
import type { AgentImage } from "@/lib/agent/images";
import { FILE_LIMITS, fileName, isPicture, isTextFile, type ChatFile } from "@/lib/bot/attachments";
import { useAttachedImages } from "@/components/ide/use-attached-images";

/** What goes with a message: pictures (`agent/images.ts`) and text files (`attachments.ts`). */
export type Attached = { images: AgentImage[]; files: ChatFile[] };
export const NOTHING_ATTACHED: Attached = { images: [], files: [] };

/** The names a message keeps of what came with it, pictures first. */
export const attachedNames = (a: Attached) => [
  ...a.images.map((i) => i.name),
  ...a.files.map((f) => f.name),
];

/**
 * What waits to go with the next message in a chat: pictures, resized in the
 * browser, and text files, read in it. Each picked, pasted or dropped file
 * goes where it belongs, or `error` says why not.
 */
export function useAttachments() {
  const pictures = useAttachedImages();
  const [files, setFiles] = useState<ChatFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const attach = async (list: File[]) => {
    setError(null);
    const pics = list.filter((f) => isPicture(f.type));
    if (pics.length > 0) await pictures.add(pics);
    const next = [...files];
    for (const file of list) {
      if (isPicture(file.type)) continue;
      if (!isTextFile(file.name, file.type)) {
        setError(`${fileName(file.name)} isn't a picture or a text file.`);
        continue;
      }
      if (next.length >= FILE_LIMITS.files) {
        setError(`Attach at most ${FILE_LIMITS.files} files to a message.`);
        break;
      }
      const text = await file.text().catch(() => null);
      if (text === null) {
        setError(`${fileName(file.name)} could not be read.`);
        continue;
      }
      if (text.length > FILE_LIMITS.chars) {
        setError(`${fileName(file.name)} is too long. Attach a shorter file.`);
        continue;
      }
      next.push({ name: fileName(file.name), text });
    }
    if (next.reduce((n, f) => n + f.text.length, 0) > FILE_LIMITS.total)
      setError("Those files are too long together. Attach fewer.");
    else setFiles(next);
  };

  const { clear: clearPictures } = pictures;
  /** What is attached, handed over and cleared from the box: the message is being sent. */
  const take = useCallback((): Attached => {
    const taken = { images: pictures.images, files };
    clearPictures();
    setFiles([]);
    setError(null);
    return taken;
  }, [pictures.images, files, clearPictures]);

  return {
    images: pictures.images,
    files,
    /** A picture is still being made smaller. */
    busy: pictures.busy,
    any: pictures.images.length > 0 || files.length > 0,
    error,
    attach,
    take,
    removeImage: pictures.remove,
    removeFile: (index: number) => setFiles((now) => now.filter((_, i) => i !== index)),
  };
}

export type Attachments = ReturnType<typeof useAttachments>;
