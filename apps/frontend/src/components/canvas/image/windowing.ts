import type { WindowLevel } from "./types";

/**
 * Maps grayscale values through a linear window (VOI LUT) into opaque RGBA.
 * `target` must hold width × height × 4 bytes.
 */
export function renderWindowed(
  pixels: Float32Array,
  window: WindowLevel,
  invert: boolean,
  target: Uint8ClampedArray,
): void {
  const lower = window.center - window.width / 2;
  const scale = 255 / Math.max(window.width, Number.EPSILON);
  for (let i = 0; i < pixels.length; i++) {
    let v = (pixels[i]! - lower) * scale;
    v = v < 0 ? 0 : v > 255 ? 255 : v;
    if (invert) v = 255 - v;
    const o = i * 4;
    target[o] = v;
    target[o + 1] = v;
    target[o + 2] = v;
    target[o + 3] = 255;
  }
}

/**
 * Window/level drag: horizontal movement changes the width (contrast), vertical movement the
 * centre (brightness). Sensitivity scales with the image's value range.
 */
export function adjustWindow(
  start: WindowLevel,
  dx: number,
  dy: number,
  valueRange: number,
): WindowLevel {
  const sensitivity = Math.max(valueRange, 1) / 512;
  return {
    center: start.center + dy * sensitivity,
    width: Math.max(1, start.width + dx * sensitivity),
  };
}
