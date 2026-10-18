import { describe, expect, it } from "vitest";
import { clampScale, fitToCanvas, imageToScreen, isInsideImage, MAX_SCALE, MIN_SCALE, panBy, screenToImage, zoomAt } from "./viewport";

describe("viewport", () => {
  it("fits and centres the image with a margin", () => {
    expect(fitToCanvas(2000, 1000, 1032, 1032, 16)).toEqual({ scale: 0.5, offsetX: 16, offsetY: 266 });
  });

  it("round-trips image ↔ screen coordinates", () => {
    const viewport = { scale: 2.5, offsetX: -40, offsetY: 13 };
    const point = { x: 123.4, y: 56.7 };
    const back = screenToImage(viewport, imageToScreen(viewport, point));
    expect(back.x).toBeCloseTo(point.x, 10);
    expect(back.y).toBeCloseTo(point.y, 10);
  });

  it("zooms around the cursor and clamps the scale", () => {
    const viewport = { scale: 1, offsetX: 0, offsetY: 0 };
    const cursor = { x: 300, y: 200 };
    const zoomed = zoomAt(viewport, cursor, 2);
    expect(screenToImage(zoomed, cursor)).toEqual(screenToImage(viewport, cursor));
    expect(zoomAt(viewport, cursor, 1e6).scale).toBe(MAX_SCALE);
    expect(zoomAt(viewport, cursor, 1e-6).scale).toBe(MIN_SCALE);
    expect(clampScale(Number.NaN)).toBe(1);
  });

  it("pans and tests image bounds", () => {
    expect(panBy({ scale: 1, offsetX: 5, offsetY: 5 }, 10, -5)).toEqual({ scale: 1, offsetX: 15, offsetY: 0 });
    expect(isInsideImage({ x: 0, y: 100 }, 100, 100)).toBe(true);
    expect(isInsideImage({ x: -0.1, y: 5 }, 100, 100)).toBe(false);
    expect(isInsideImage({ x: 5, y: 100.1 }, 100, 100)).toBe(false);
  });
});
