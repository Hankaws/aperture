/** The mascot as a PNG, for a GitHub App's logo. Browser only. */
import { mascotSvg, type Mascot } from "./mascot.ts";

export async function mascotPng(mascot: Mascot, size = 512): Promise<Blob> {
  const url = URL.createObjectURL(
    new Blob([mascotSvg(mascot, { id: "png" })], { type: "image/svg+xml" }),
  );
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot draw the picture.");
    ctx.drawImage(img, 0, 0, size, size);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not make the PNG."))),
        "image/png",
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Saves the mascot as `<name>.png`. */
export async function downloadMascot(mascot: Mascot, name: string): Promise<void> {
  const url = URL.createObjectURL(await mascotPng(mascot));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "aperture-bot"}.png`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
