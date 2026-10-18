import { fitCircle, vectorBetween, length } from './geometry.js';
import type { Point2D } from './geometry.js';

/**
 * Pixel-to-millimetre scale of a radiograph. Radiographs magnify anatomy, so calibrate with a
 * marker of known size placed at the level of the bone being measured.
 */
export interface Calibration {
    mmPerPixel: number;
}

function assertPositive(value: number, name: string): void {
    if (!Number.isFinite(value) || value <= 0) {
        throw new RangeError(`${name} must be a positive, finite number`);
    }
}

/** From a straight object of known length (e.g. a calibration rod) marked by its two ends. */
export function calibrationFromKnownLength(start: Point2D, end: Point2D, knownLengthMm: number): Calibration {
    assertPositive(knownLengthMm, 'Known length (mm)');
    const pixels = length(vectorBetween(start, end, 'Calibration segment'));
    return { mmPerPixel: knownLengthMm / pixels };
}

/** From points clicked around a spherical marker of known diameter (e.g. a 25 mm ball). */
export function calibrationFromMarker(outlinePoints: readonly Point2D[], markerDiameterMm: number): Calibration {
    assertPositive(markerDiameterMm, 'Marker diameter (mm)');
    const { radius } = fitCircle(outlinePoints);
    return { mmPerPixel: markerDiameterMm / (2 * radius) };
}

export function pixelsToMillimetres(pixels: number, calibration: Calibration): number {
    assertPositive(calibration.mmPerPixel, 'Calibration mmPerPixel');
    return pixels * calibration.mmPerPixel;
}

export function millimetresToPixels(millimetres: number, calibration: Calibration): number {
    assertPositive(calibration.mmPerPixel, 'Calibration mmPerPixel');
    return millimetres / calibration.mmPerPixel;
}
