import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { decodeDicom, isDicomFile, TRANSFER_SYNTAX } from "./dicom";
import type { JpegBaselineDecoder } from "./dicom";
import { ImageLoadError } from "./types";
import type { TestElement } from "../__fixtures__/dicom-writer";
import { IMPLICIT_LE, imageElements, uint16Bytes, writeDicom } from "../__fixtures__/dicom-writer";

const EXPLICIT_LE = TRANSFER_SYNTAX.EXPLICIT_VR_LITTLE_ENDIAN;
const noJpeg: JpegBaselineDecoder = () => Promise.reject(new Error("JPEG decoder should not be called"));

function decode(bytes: Uint8Array, decoder: JpegBaselineDecoder = noJpeg) {
  return decodeDicom(bytes, "test.dcm", decoder);
}

describe("isDicomFile", () => {
  it("detects the DICM magic after the preamble", () => {
    expect(isDicomFile(writeDicom({ transferSyntax: EXPLICIT_LE, elements: [] }))).toBe(true);
    expect(isDicomFile(new Uint8Array(200))).toBe(false);
    expect(isDicomFile(new Uint8Array(10))).toBe(false);
  });
});

describe("decodeDicom: native pixel data", () => {
  it("decodes 16-bit explicit VR with rescale, window, spacing and metadata", async () => {
    const elements: TestElement[] = [
      ...imageElements({ rows: 2, columns: 3, bitsAllocated: 16, bitsStored: 12 }),
      { tag: [0x0008, 0x0020], vr: "DA", value: "20261018" },
      { tag: [0x0008, 0x0060], vr: "CS", value: "DX" },
      { tag: [0x0010, 0x0010], vr: "PN", value: "Rex^Silva" },
      { tag: [0x0010, 0x2201], vr: "LO", value: "Canine" },
      { tag: [0x0018, 0x0015], vr: "CS", value: "STIFLE" },
      { tag: [0x0018, 0x5101], vr: "CS", value: "LL" },
      { tag: [0x0028, 0x0030], vr: "DS", value: "0.15\\0.15" },
      { tag: [0x0028, 0x1050], vr: "DS", value: "2048" },
      { tag: [0x0028, 0x1051], vr: "DS", value: "4096" },
      { tag: [0x0028, 0x1052], vr: "DS", value: "-1000" },
      { tag: [0x0028, 0x1053], vr: "DS", value: "2" },
    ];
    // 0xF00A: high bits outside BitsStored (12) must be ignored → 0x00A = 10
    const image = await decode(
      writeDicom({ transferSyntax: EXPLICIT_LE, elements, pixelData: { native: uint16Bytes([0, 1, 2, 4095, 0xf00a, 100]) } }),
    );

    expect(image).toMatchObject({ width: 3, height: 2, invert: false, defaultWindow: { center: 2048, width: 4096 } });
    expect(Array.from(image.pixels)).toEqual([-1000, -998, -996, 7190, -980, -800]);
    expect(image.minValue).toBe(-1000);
    expect(image.maxValue).toBe(7190);
    expect(image.pixelSpacing).toEqual({ mmPerPixel: 0.15, source: "PixelSpacing" });
    expect(image.warnings).toEqual([]);
    expect(image.metadata).toMatchObject({
      format: "DICOM",
      patientName: "Rex Silva",
      species: "Canine",
      studyDate: "2026-10-18",
      modality: "DX",
      bodyPart: "STIFLE",
      viewPosition: "LL",
      transferSyntax: EXPLICIT_LE,
    });
  });

  it("decodes 8-bit implicit VR MONOCHROME1 with a full-range default window", async () => {
    const image = await decode(
      writeDicom({
        transferSyntax: IMPLICIT_LE,
        elements: imageElements({ rows: 1, columns: 4, bitsAllocated: 8, photometric: "MONOCHROME1" }),
        pixelData: { native: new Uint8Array([10, 20, 30, 250]) },
      }),
    );
    expect(Array.from(image.pixels)).toEqual([10, 20, 30, 250]);
    expect(image.invert).toBe(true);
    expect(image.defaultWindow).toEqual({ center: 130, width: 240 });
    expect(image.pixelSpacing).toBeUndefined();
  });

  it("sign-extends signed data with fewer stored bits", async () => {
    const image = await decode(
      writeDicom({
        transferSyntax: EXPLICIT_LE,
        elements: imageElements({ rows: 1, columns: 3, bitsAllocated: 16, bitsStored: 12, signed: true }),
        pixelData: { native: uint16Bytes([0x0fff, 0x0800, 0x07ff]) },
      }),
    );
    expect(Array.from(image.pixels)).toEqual([-1, -2048, 2047]);
  });

  it("falls back to ImagerPixelSpacing with a magnification warning, and rejects non-square pixels", async () => {
    const base = imageElements({ rows: 1, columns: 1, bitsAllocated: 8 });
    const imager = await decode(
      writeDicom({
        transferSyntax: EXPLICIT_LE,
        elements: [...base, { tag: [0x0018, 0x1164], vr: "DS", value: "0.1\\0.1" }],
        pixelData: { native: new Uint8Array([1]) },
      }),
    );
    expect(imager.pixelSpacing).toEqual({ mmPerPixel: 0.1, source: "ImagerPixelSpacing" });
    expect(imager.warnings[0]).toContain("isn't corrected for magnification");

    const nonSquare = await decode(
      writeDicom({
        transferSyntax: EXPLICIT_LE,
        elements: [...base, { tag: [0x0028, 0x0030], vr: "DS", value: "0.1\\0.2" }],
        pixelData: { native: new Uint8Array([1]) },
      }),
    );
    expect(nonSquare.pixelSpacing).toBeUndefined();
    expect(nonSquare.warnings[0]).toContain("non-square pixels");
  });

  it("shows the first frame of multi-frame files with a warning", async () => {
    const image = await decode(
      writeDicom({
        transferSyntax: EXPLICIT_LE,
        elements: [...imageElements({ rows: 1, columns: 2, bitsAllocated: 8 }), { tag: [0x0028, 0x0008], vr: "IS", value: "2" }],
        pixelData: { native: new Uint8Array([1, 2, 3, 4]) },
      }),
    );
    expect(Array.from(image.pixels)).toEqual([1, 2]);
    expect(image.warnings).toEqual(["Only the first of 2 frames is shown"]);
  });
});

describe("decodeDicom: compressed pixel data", () => {
  it("decodes a real JPEG Lossless file", async () => {
    const bytes = new Uint8Array(readFileSync(new URL("../__fixtures__/jpeg-lossless-sel1.dcm", import.meta.url)));
    const image = await decode(bytes);
    expect(image).toMatchObject({ width: 256, height: 256 });
    expect(image.metadata.transferSyntax).toBe(TRANSFER_SYNTAX.JPEG_LOSSLESS);
    expect(image.pixels).toHaveLength(256 * 256);
    expect(image.maxValue).toBeGreaterThan(image.minValue);
    expect(image.pixelSpacing?.source).toBe("PixelSpacing");
  });

  it("hands JPEG Baseline frames to the browser decoder", async () => {
    const decoder = vi.fn(async (jpeg: Uint8Array) => {
      expect(Array.from(jpeg)).toEqual([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9, 0]);
      return { width: 2, height: 1, luminance: new Float32Array([0, 255]) };
    });
    const file = writeDicom({
      transferSyntax: TRANSFER_SYNTAX.JPEG_BASELINE,
      elements: imageElements({ rows: 1, columns: 2, bitsAllocated: 8, samplesPerPixel: 3, photometric: "YBR_FULL_422" }),
      // The second fragment has odd length, so the writer pads it with one 0 byte
      pixelData: { fragments: [new Uint8Array([0xff, 0xd8, 1, 2]), new Uint8Array([3, 0xff, 0xd9])] },
    });
    const image = await decode(file, decoder);
    expect(decoder).toHaveBeenCalledOnce();
    expect(Array.from(image.pixels)).toEqual([0, 255]);

    const wrongSize = vi.fn(async () => ({ width: 5, height: 5, luminance: new Float32Array(25) }));
    await expect(decode(file, wrongSize)).rejects.toThrow("doesn't match the DICOM header");
  });
});

describe("decodeDicom: errors the user can act on", () => {
  const image = (transferSyntax: string, extra: TestElement[] = [], native = new Uint8Array([1, 2])) =>
    writeDicom({ transferSyntax, elements: [...imageElements({ rows: 1, columns: 1, bitsAllocated: 16 }), ...extra], pixelData: { native } });

  it.each([
    ["not DICOM", new Uint8Array(300), "isn't a readable DICOM file"],
    ["no pixel data", writeDicom({ transferSyntax: EXPLICIT_LE, elements: imageElements({ rows: 1, columns: 1, bitsAllocated: 8 }) }), "contains no image"],
    ["JPEG 2000", image("1.2.840.10008.1.2.4.90"), "JPEG 2000 Lossless compression isn't supported yet"],
    ["unknown syntax", image("1.2.3.999"), "1.2.3.999 compression isn't supported yet"],
    ["colour", image(EXPLICIT_LE, [{ tag: [0x0028, 0x0004], vr: "CS", value: "RGB" }]), "Colour DICOM images (RGB)"],
    ["truncated", image(EXPLICIT_LE, [], new Uint8Array(0)), "truncated"],
    [
      "32-bit",
      writeDicom({ transferSyntax: EXPLICIT_LE, elements: imageElements({ rows: 1, columns: 1, bitsAllocated: 32 }), pixelData: { native: new Uint8Array(4) } }),
      "32-bit DICOM pixel data isn't supported",
    ],
  ])("%s", async (_name, bytes, message) => {
    const promise = decode(bytes);
    await expect(promise).rejects.toBeInstanceOf(ImageLoadError);
    await expect(decode(bytes)).rejects.toThrow(message);
  });
});
