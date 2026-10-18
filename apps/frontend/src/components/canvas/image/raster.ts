import { ImageLoadError } from "./types";
import type { DecodedFrame } from "./types";

/** ITU-R BT.601 luma: radiograph photos/exports are grayscale, colour is folded into one channel. */
export function rgbaToLuminance(rgba: Uint8ClampedArray, pixelCount: number): Float32Array {
  const luminance = new Float32Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    const o = i * 4;
    luminance[i] = 0.299 * rgba[o]! + 0.587 * rgba[o + 1]! + 0.114 * rgba[o + 2]!;
  }
  return luminance;
}

/** Decodes PNG/JPEG/WebP bytes with the browser's own codecs. Browser-only. */
export async function decodeRasterImage(bytes: Uint8Array, mimeType: string): Promise<DecodedFrame> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(new Blob([bytes.slice()], { type: mimeType }));
  } catch {
    throw new ImageLoadError("The browser couldn't decode this image");
  }
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new ImageLoadError("This browser can't process images (no 2D canvas)");
  }
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  return { width: canvas.width, height: canvas.height, luminance: rgbaToLuminance(data, canvas.width * canvas.height) };
}
