import type { ImageSpacing } from "@vet-plan/shared";

export interface WindowLevel {
  center: number;
  width: number;
}

/** PixelSpacing is calibrated at the patient; ImagerPixelSpacing is at the detector (magnified). */
export type PixelSpacing = ImageSpacing;

export interface ImageMetadata {
  fileName: string;
  format: "DICOM" | "PNG" | "JPEG" | "WEBP" | "IMAGE";
  patientName?: string;
  species?: string;
  studyDate?: string;
  modality?: string;
  bodyPart?: string;
  viewPosition?: string;
  transferSyntax?: string;
}

/** A single-channel radiograph ready for windowing and measurement. */
export interface RadiographImage {
  width: number;
  height: number;
  /** Row-major grayscale values in modality units (rescale slope/intercept applied). */
  pixels: Float32Array;
  minValue: number;
  maxValue: number;
  defaultWindow: WindowLevel;
  /** MONOCHROME1: low values display as white. */
  invert: boolean;
  pixelSpacing?: PixelSpacing;
  /** Non-fatal notes for the user (multi-frame, detector-plane scale, ...). */
  warnings: string[];
  metadata: ImageMetadata;
}

/** A failure the user can act on (unsupported format, corrupt file); message is shown verbatim. */
export class ImageLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageLoadError";
  }
}

/** Luminance of a decoded raster frame (JPEG baseline DICOM, PNG/JPEG files). */
export interface DecodedFrame {
  width: number;
  height: number;
  luminance: Float32Array;
}
