import { decodeDicom, isDicomFile } from "./dicom";
import { fullRangeWindow, valueRange } from "./pixel-stats";
import { decodeRasterImage } from "./raster";
import { ImageLoadError } from "./types";
import type { ImageMetadata, RadiographImage } from "./types";

const RASTER_FORMATS: Record<string, ImageMetadata["format"]> = {
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "image/webp": "WEBP",
};

/** 300 MB: far above any single radiograph, but stops the tab from freezing on a wrong file. */
const MAX_FILE_BYTES = 300 * 1024 * 1024;

/**
 * Loads a radiograph entirely in the browser: the file never leaves the user's machine.
 * DICOM is detected by content (many PACS exports have no extension); other files by MIME type.
 */
export async function loadRadiograph(file: File): Promise<RadiographImage> {
  if (file.size > MAX_FILE_BYTES) {
    throw new ImageLoadError("This file is too large to open in the browser (over 300 MB)");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());

  if (isDicomFile(bytes) || /\.dcm$/i.test(file.name)) {
    return decodeDicom(bytes, file.name, (jpeg) => decodeRasterImage(jpeg, "image/jpeg"));
  }

  const format = RASTER_FORMATS[file.type];
  if (!format) {
    throw new ImageLoadError("Unsupported file: open a DICOM (.dcm), PNG, JPEG or WebP radiograph");
  }
  const frame = await decodeRasterImage(bytes, file.type);
  const { minValue, maxValue } = valueRange(frame.luminance);
  return {
    width: frame.width,
    height: frame.height,
    pixels: frame.luminance,
    minValue,
    maxValue,
    defaultWindow: fullRangeWindow(0, 255),
    invert: false,
    warnings: ["Plain images carry no scale: calibrate with a marker or known length before measuring in millimetres"],
    metadata: { fileName: file.name, format },
  };
}
