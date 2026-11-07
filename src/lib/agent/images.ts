/**
 * Images attached to an agent turn: a screenshot of a broken UI, pasted or
 * dropped into the agent panel. The browser resizes each to JPEG before it
 * is sent (`image-resize.ts`); here are the limits the server holds it to,
 * and how each provider is sent it. The images go with the turn they were
 * attached to; later turns carry a note that they were, not the images, so
 * a long thread does not resend them every step. Pure, for tests.
 */

export type AgentImage = {
  /** The file's name as the person gave it, or "screenshot.png" for a paste. */
  name: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  /** Base64, without the `data:` prefix. */
  data: string;
};

/** At most this many to a turn. */
export const MAX_IMAGES = 3;
/** Base64 characters per image, and for all of a turn's: room under the request limit next to 2.5 MB of files. */
export const MAX_IMAGE_CHARS = 400_000;
export const MAX_IMAGES_CHARS = 900_000;
/** The longest side the browser resizes to. */
export const MAX_IMAGE_SIDE = 1280;

const TYPES = new Set<AgentImage["mediaType"]>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** The images of a request, checked; an error says what is wrong in words for the person. */
export function validImages(raw: unknown): { images: AgentImage[] } | { error: string } {
  if (raw === undefined || raw === null) return { images: [] };
  if (!Array.isArray(raw)) return { error: "The images could not be read." };
  if (raw.length > MAX_IMAGES)
    return { error: `Attach at most ${MAX_IMAGES} images to a message.` };
  const images: AgentImage[] = [];
  let total = 0;
  for (const row of raw) {
    const image = row as Partial<AgentImage> | null;
    if (
      !image ||
      typeof image.data !== "string" ||
      !TYPES.has(image.mediaType as AgentImage["mediaType"])
    )
      return { error: "Attach PNG, JPEG, WebP or GIF images." };
    if (image.data.length > MAX_IMAGE_CHARS || !BASE64.test(image.data))
      return { error: "An image is too large. Attach a smaller screenshot." };
    total += image.data.length;
    const name = typeof image.name === "string" && image.name.trim() ? image.name.trim() : "image";
    images.push({
      name: name.slice(0, 120),
      mediaType: image.mediaType as AgentImage["mediaType"],
      data: image.data,
    });
  }
  if (total > MAX_IMAGES_CHARS)
    return { error: "Those images are too large together. Attach fewer." };
  return { images };
}

/** Engines whose models are sent images. DeepSeek's chat model reads text only. */
export function seesImages(engine: string): boolean {
  return engine !== "deepseek";
}

export const NO_IMAGES_ERROR =
  "DeepSeek's model can't see images. Pick another model in the model menu, or send the message without them.";

/** What a later turn is told in place of the images, after the message they came with. */
export function imagesNote(images: Array<Pick<AgentImage, "name">>): string {
  if (images.length === 0) return "";
  const names = images.map((i) => i.name).join(", ");
  return images.length === 1
    ? `[The user attached an image: ${names}]`
    : `[The user attached ${images.length} images: ${names}]`;
}

type Message = { role: string; content?: string | null; images?: AgentImage[]; cache?: boolean };

/**
 * Messages as OpenAI-compatible APIs take them (OpenAI, Grok, Gemini, a custom
 * or local endpoint): a message with images becomes text and `image_url`
 * parts. `cache` is a hosted-provider marker and is kept only when `keepCache`.
 */
export function toOpenAiMessages<T extends Message>(
  messages: T[],
  keepCache = true,
): Array<Record<string, unknown>> {
  return messages.map(({ images, cache, ...rest }) => {
    const message: Record<string, unknown> =
      keepCache && cache !== undefined ? { ...rest, cache } : { ...rest };
    if (!images?.length) return message;
    return {
      ...message,
      content: [
        { type: "text", text: rest.content ?? "" },
        ...images.map((image) => ({
          type: "image_url",
          image_url: { url: `data:${image.mediaType};base64,${image.data}` },
        })),
      ],
    };
  });
}

/** A user message's content as Anthropic's Messages API takes it: the images first, then the text. */
export function anthropicContent(
  text: string,
  images: AgentImage[] | undefined,
): string | Array<Record<string, unknown>> {
  if (!images?.length) return text;
  return [
    ...images.map((image) => ({
      type: "image",
      source: { type: "base64", media_type: image.mediaType, data: image.data },
    })),
    { type: "text", text },
  ];
}
