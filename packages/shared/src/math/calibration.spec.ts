import { describe, expect, it } from 'vitest';
import {
    calibrationFromKnownLength,
    calibrationFromMarker,
    millimetresToPixels,
    pixelsToMillimetres,
} from './calibration.js';
import { polar } from './__fixtures__/transforms.js';

describe('calibration', () => {
    it('derives mm/pixel from a segment of known length', () => {
        const calibration = calibrationFromKnownLength({ x: 10, y: 10 }, { x: 130, y: 170 }, 50);
        expect(calibration.mmPerPixel).toBeCloseTo(0.25, 12);
    });

    it('derives mm/pixel from points around a 25 mm marker ball', () => {
        const points = [0, 72, 144, 216, 288].map((deg) => polar({ x: 900, y: 1200 }, deg, 50));
        expect(calibrationFromMarker(points, 25).mmPerPixel).toBeCloseTo(0.25, 10);
    });

    it('converts in both directions', () => {
        const calibration = { mmPerPixel: 0.2 };
        expect(pixelsToMillimetres(50, calibration)).toBeCloseTo(10, 12);
        expect(millimetresToPixels(10, calibration)).toBeCloseTo(50, 12);
    });

    it('rejects invalid sizes and scales', () => {
        expect(() => calibrationFromKnownLength({ x: 0, y: 0 }, { x: 1, y: 0 }, 0)).toThrow(RangeError);
        expect(() => calibrationFromKnownLength({ x: 0, y: 0 }, { x: 0, y: 0 }, 10)).toThrow(RangeError);
        expect(() => calibrationFromMarker([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], -25)).toThrow(RangeError);
        expect(() => pixelsToMillimetres(10, { mmPerPixel: 0 })).toThrow(RangeError);
        expect(() => millimetresToPixels(10, { mmPerPixel: NaN })).toThrow(RangeError);
    });
});
