import type { Point2D } from "@vet-plan/shared";

/** screen = image × scale + offset (CSS pixels). */
export interface Viewport {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export const MIN_SCALE = 0.02;
export const MAX_SCALE = 40;

/** Largest scale that shows the whole image, centred, with a margin. */
export function fitToCanvas(
  imageWidth: number,
  imageHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  margin = 16,
): Viewport {
  const scale = clampScale(
    Math.min((canvasWidth - 2 * margin) / imageWidth, (canvasHeight - 2 * margin) / imageHeight),
  );
  return {
    scale,
    offsetX: (canvasWidth - imageWidth * scale) / 2,
    offsetY: (canvasHeight - imageHeight * scale) / 2,
  };
}

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number.isFinite(scale) && scale > 0 ? scale : 1));
}

export function imageToScreen(viewport: Viewport, point: Point2D): Point2D {
  return { x: point.x * viewport.scale + viewport.offsetX, y: point.y * viewport.scale + viewport.offsetY };
}

export function screenToImage(viewport: Viewport, point: Point2D): Point2D {
  return { x: (point.x - viewport.offsetX) / viewport.scale, y: (point.y - viewport.offsetY) / viewport.scale };
}

/** Zooms by `factor`, keeping the image point under `screenPoint` fixed. */
export function zoomAt(viewport: Viewport, screenPoint: Point2D, factor: number): Viewport {
  const scale = clampScale(viewport.scale * factor);
  const anchor = screenToImage(viewport, screenPoint);
  return {
    scale,
    offsetX: screenPoint.x - anchor.x * scale,
    offsetY: screenPoint.y - anchor.y * scale,
  };
}

export function panBy(viewport: Viewport, dx: number, dy: number): Viewport {
  return { ...viewport, offsetX: viewport.offsetX + dx, offsetY: viewport.offsetY + dy };
}

export function isInsideImage(point: Point2D, width: number, height: number): boolean {
  return point.x >= 0 && point.y >= 0 && point.x <= width && point.y <= height;
}
