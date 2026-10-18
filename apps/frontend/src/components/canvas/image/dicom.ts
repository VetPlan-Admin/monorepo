import { Decoder } from "jpeg-lossless-decoder-js";
import { dicomParser } from "./dicom-parser-module";
import type { DataSet, Element } from "./dicom-parser-module";
import { fullRangeWindow, valueRange } from "./pixel-stats";
import { ImageLoadError } from "./types";
import type { DecodedFrame, PixelSpacing, RadiographImage, WindowLevel } from "./types";

export const TRANSFER_SYNTAX = {
  IMPLICIT_VR_LITTLE_ENDIAN: "1.2.840.10008.1.2",
  EXPLICIT_VR_LITTLE_ENDIAN: "1.2.840.10008.1.2.1",
  JPEG_BASELINE: "1.2.840.10008.1.2.4.50",
  JPEG_LOSSLESS: "1.2.840.10008.1.2.4.57",
  JPEG_LOSSLESS_SV1: "1.2.840.10008.1.2.4.70",
} as const;

const UNSUPPORTED_TRANSFER_SYNTAX_NAMES: Record<string, string> = {
  "1.2.840.10008.1.2.2": "Explicit VR Big Endian",
  "1.2.840.10008.1.2.1.99": "Deflated Explicit VR Little Endian",
  "1.2.840.10008.1.2.4.51": "JPEG Extended (12-bit)",
  "1.2.840.10008.1.2.4.80": "JPEG-LS Lossless",
  "1.2.840.10008.1.2.4.81": "JPEG-LS Near-lossless",
  "1.2.840.10008.1.2.4.90": "JPEG 2000 Lossless",
  "1.2.840.10008.1.2.4.91": "JPEG 2000",
  "1.2.840.10008.1.2.5": "RLE Lossless",
};

/** Browser-side JPEG decoder for JPEG Baseline frames (injected so Node tests can stub it). */
export type JpegBaselineDecoder = (jpeg: Uint8Array) => Promise<DecodedFrame>;

/** Part 10 files carry "DICM" after a 128-byte preamble. */
export function isDicomFile(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 132 &&
    bytes[128] === 0x44 && // D
    bytes[129] === 0x49 && // I
    bytes[130] === 0x43 && // C
    bytes[131] === 0x4d // M
  );
}

function text(dataSet: DataSet, tag: string): string | undefined {
  const value = dataSet.string(tag)?.trim();
  return value ? value : undefined;
}

function decimals(dataSet: DataSet, tag: string): number[] {
  return (text(dataSet, tag) ?? "").split("\\").map(Number).filter(Number.isFinite);
}

function readNativePixels(
  bytes: Uint8Array,
  element: Element,
  count: number,
  bitsAllocated: number,
  bitsStored: number,
  signed: boolean,
): Float32Array {
  const bytesPerPixel = bitsAllocated / 8;
  if (element.length < count * bytesPerPixel || element.dataOffset + count * bytesPerPixel > bytes.length) {
    throw new ImageLoadError("The image data is truncated: the file may be incomplete");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset + element.dataOffset, count * bytesPerPixel);
  const pixels = new Float32Array(count);
  const unusedBits = 32 - bitsStored;
  for (let i = 0; i < count; i++) {
    const raw = bitsAllocated === 8 ? view.getUint8(i) : view.getUint16(i * 2, true);
    // Keep only the stored bits; sign-extend them for signed data
    pixels[i] = signed ? (raw << unusedBits) >> unusedBits : (raw << unusedBits) >>> unusedBits;
  }
  return pixels;
}

function firstEncapsulatedFrame(dataSet: DataSet, element: Element): Uint8Array {
  const fragments = element.fragments ?? [];
  if (fragments.length === 0) {
    throw new ImageLoadError("The compressed image data is empty");
  }
  const frameCount = dataSet.intString("x00280008") ?? 1;
  if (frameCount <= 1) {
    return dicomParser.readEncapsulatedPixelDataFromFragments(dataSet, element, 0, fragments.length);
  }
  const offsets = element.basicOffsetTable?.length
    ? element.basicOffsetTable
    : dicomParser.createJPEGBasicOffsetTable(dataSet, element);
  return dicomParser.readEncapsulatedImageFrame(dataSet, element, 0, offsets);
}

function decodeJpegLossless(frame: Uint8Array, count: number, bitsAllocated: number, signed: boolean): Float32Array {
  // Copy into a standalone buffer: the decoder reads from offset 0 of the ArrayBuffer it gets
  const output = new Decoder().decompress(frame.slice().buffer);
  const samples =
    bitsAllocated <= 8 ? new Uint8Array(output) : signed ? new Int16Array(output) : new Uint16Array(output);
  if (samples.length < count) {
    throw new ImageLoadError("The JPEG Lossless image is smaller than its declared size");
  }
  return Float32Array.from(samples.subarray(0, count));
}

function pixelSpacing(dataSet: DataSet, warnings: string[]): PixelSpacing | undefined {
  const sources = [
    ["x00280030", "PixelSpacing"],
    ["x00181164", "ImagerPixelSpacing"],
  ] as const;
  for (const [tag, source] of sources) {
    const [row, column] = decimals(dataSet, tag);
    if (row === undefined || column === undefined || row <= 0 || column <= 0) {
      continue;
    }
    if (Math.abs(row - column) / Math.max(row, column) > 0.01) {
      warnings.push("The image has non-square pixels: calibrate with a marker before measuring in millimetres");
      return undefined;
    }
    if (source === "ImagerPixelSpacing") {
      warnings.push(
        "Scale comes from the detector (ImagerPixelSpacing) and isn't corrected for magnification. Calibrate with a marker for accurate millimetres",
      );
    }
    return { mmPerPixel: (row + column) / 2, source };
  }
  return undefined;
}

function formatDate(value: string | undefined): string | undefined {
  return value && /^\d{8}$/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : value;
}

/** Decodes the first frame of a single-channel DICOM radiograph. */
export async function decodeDicom(
  bytes: Uint8Array,
  fileName: string,
  decodeJpegBaseline: JpegBaselineDecoder,
): Promise<RadiographImage> {
  let dataSet: DataSet;
  try {
    dataSet = dicomParser.parseDicom(bytes);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new ImageLoadError(`This file isn't a readable DICOM file (${reason})`);
  }

  const transferSyntax = text(dataSet, "x00020010") ?? TRANSFER_SYNTAX.IMPLICIT_VR_LITTLE_ENDIAN;
  const rows = dataSet.uint16("x00280010");
  const columns = dataSet.uint16("x00280011");
  const pixelElement = dataSet.elements.x7fe00010;
  if (!rows || !columns || !pixelElement) {
    throw new ImageLoadError("This DICOM file contains no image");
  }

  const samplesPerPixel = dataSet.uint16("x00280002") ?? 1;
  const photometric = text(dataSet, "x00280004") ?? "MONOCHROME2";
  const isJpegBaseline = transferSyntax === TRANSFER_SYNTAX.JPEG_BASELINE;
  if (!isJpegBaseline && (samplesPerPixel !== 1 || !photometric.startsWith("MONOCHROME"))) {
    throw new ImageLoadError(`Colour DICOM images (${photometric}) aren't supported: export the radiograph as grayscale`);
  }

  const bitsAllocated = dataSet.uint16("x00280100") ?? 16;
  const bitsStored = dataSet.uint16("x00280101") ?? bitsAllocated;
  const signed = dataSet.uint16("x00280103") === 1;
  const count = rows * columns;
  const warnings: string[] = [];

  let pixels: Float32Array;
  switch (transferSyntax) {
    case TRANSFER_SYNTAX.IMPLICIT_VR_LITTLE_ENDIAN:
    case TRANSFER_SYNTAX.EXPLICIT_VR_LITTLE_ENDIAN:
      if (bitsAllocated !== 8 && bitsAllocated !== 16) {
        throw new ImageLoadError(`${bitsAllocated}-bit DICOM pixel data isn't supported`);
      }
      pixels = readNativePixels(bytes, pixelElement, count, bitsAllocated, bitsStored, signed);
      break;
    case TRANSFER_SYNTAX.JPEG_LOSSLESS:
    case TRANSFER_SYNTAX.JPEG_LOSSLESS_SV1:
      pixels = decodeJpegLossless(firstEncapsulatedFrame(dataSet, pixelElement), count, bitsAllocated, signed);
      break;
    case TRANSFER_SYNTAX.JPEG_BASELINE: {
      const frame = await decodeJpegBaseline(firstEncapsulatedFrame(dataSet, pixelElement));
      if (frame.width !== columns || frame.height !== rows) {
        throw new ImageLoadError("The JPEG image size doesn't match the DICOM header");
      }
      pixels = frame.luminance;
      break;
    }
    default: {
      const name = UNSUPPORTED_TRANSFER_SYNTAX_NAMES[transferSyntax] ?? transferSyntax;
      throw new ImageLoadError(
        `${name} compression isn't supported yet. Export the study as uncompressed or JPEG Lossless DICOM`,
      );
    }
  }

  const slope = dataSet.floatString("x00281053") ?? 1;
  const intercept = dataSet.floatString("x00281052") ?? 0;
  if (slope !== 1 || intercept !== 0) {
    for (let i = 0; i < pixels.length; i++) pixels[i] = pixels[i]! * slope + intercept;
  }

  const { minValue, maxValue } = valueRange(pixels);
  const center = dataSet.floatString("x00281050");
  const width = dataSet.floatString("x00281051");
  const defaultWindow: WindowLevel =
    center !== undefined && width !== undefined && Number.isFinite(center) && width > 0
      ? { center, width }
      : fullRangeWindow(minValue, maxValue);

  const frameCount = dataSet.intString("x00280008") ?? 1;
  if (frameCount > 1) {
    warnings.push(`Only the first of ${frameCount} frames is shown`);
  }

  return {
    width: columns,
    height: rows,
    pixels,
    minValue,
    maxValue,
    defaultWindow,
    invert: photometric === "MONOCHROME1",
    pixelSpacing: pixelSpacing(dataSet, warnings),
    warnings,
    metadata: {
      fileName,
      format: "DICOM",
      patientName: text(dataSet, "x00100010")?.replace(/\^+/g, " ").trim(),
      species: text(dataSet, "x00102201"),
      studyDate: formatDate(text(dataSet, "x00080020")),
      modality: text(dataSet, "x00080060"),
      bodyPart: text(dataSet, "x00180015"),
      viewPosition: text(dataSet, "x00185101"),
      transferSyntax,
    },
  };
}
