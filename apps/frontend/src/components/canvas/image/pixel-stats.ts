import type { WindowLevel } from "./types";

export function valueRange(pixels: Float32Array): { minValue: number; maxValue: number } {
  let minValue = Infinity;
  let maxValue = -Infinity;
  for (let i = 0; i < pixels.length; i++) {
    const v = pixels[i]!;
    if (v < minValue) minValue = v;
    if (v > maxValue) maxValue = v;
  }
  return { minValue, maxValue };
}

/** Full-range window, used when a file carries no window of its own. */
export function fullRangeWindow(minValue: number, maxValue: number): WindowLevel {
  return { center: (minValue + maxValue) / 2, width: Math.max(maxValue - minValue, 1) };
}
