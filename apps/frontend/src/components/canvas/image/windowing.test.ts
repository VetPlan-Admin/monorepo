import { describe, expect, it } from "vitest";
import { adjustWindow, renderWindowed } from "./windowing";
import { rgbaToLuminance } from "./raster";

describe("renderWindowed", () => {
  it("maps the window linearly to 0–255 and clamps outside it", () => {
    const target = new Uint8ClampedArray(4 * 4);
    renderWindowed(new Float32Array([-100, 0, 75, 500]), { center: 50, width: 100 }, false, target);
    expect([target[0], target[4], target[8], target[12]]).toEqual([0, 0, 191, 255]); // 75 → 191.25
    expect(target[3]).toBe(255);
    expect([target[9], target[10]]).toEqual([191, 191]);
  });

  it("inverts MONOCHROME1 images", () => {
    const target = new Uint8ClampedArray(8);
    renderWindowed(new Float32Array([0, 100]), { center: 50, width: 100 }, true, target);
    expect([target[0], target[4]]).toEqual([255, 0]);
  });
});

describe("adjustWindow", () => {
  it("scales drag sensitivity with the value range and keeps width ≥ 1", () => {
    expect(adjustWindow({ center: 100, width: 200 }, 512, -512, 4096)).toEqual({ center: -3996, width: 4296 });
    expect(adjustWindow({ center: 100, width: 10 }, -5000, 0, 255).width).toBe(1);
  });
});

describe("rgbaToLuminance", () => {
  it("uses BT.601 weights", () => {
    const luminance = rgbaToLuminance(new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255, 200, 200, 200, 255]), 3);
    expect(luminance[0]).toBeCloseTo(76.245, 3);
    expect(luminance[1]).toBeCloseTo(29.07, 3);
    expect(luminance[2]).toBeCloseTo(200, 3);
  });
});
