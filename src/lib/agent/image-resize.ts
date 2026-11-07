import { MAX_IMAGE_CHARS, MAX_IMAGE_SIDE, type AgentImage } from "./images";

/**
 * A pasted, dropped or picked image as the agent is sent it: at most
 * MAX_IMAGE_SIDE on its longest side, as JPEG, smaller until it fits
 * MAX_IMAGE_CHARS. A screenshot comes out at a few hundred kilobytes, which
 * every provider that reads images accepts. Browser only.
 */
export async function toAgentImage(
  file: Blob,
  name: string,
): Promise<AgentImage | { error: string }> {
  if (!file.type.startsWith("image/")) return { error: `${name} is not an image.` };
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { error: `${name} could not be read as an image.` };
  }
  try {
    let scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height, 1));
    for (let attempt = 0; attempt < 4; attempt++) {
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return { error: "This browser cannot prepare images." };
      // JPEG has no transparency: a transparent screenshot gets a white page, not black.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);
      for (const quality of [0.85, 0.72]) {
        const data = await jpegBase64(canvas, quality);
        if (data && data.length <= MAX_IMAGE_CHARS) return { name, mediaType: "image/jpeg", data };
      }
      scale *= 0.7;
    }
    return { error: `${name} is too large, even made smaller.` };
  } finally {
    bitmap.close();
  }
}

function jpegBase64(canvas: HTMLCanvasElement, quality: number): Promise<string | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return resolve(null);
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}
