import { describe, expect, it } from 'vitest';
import {
    DEFAULT_TTA_CAGE_SIZES_MM,
    patellarTendonAngle,
    selectTtaCageSize,
    ttaAdvancement,
    ttaAdvancementMatrix,
} from './tta.js';
import { IMAGE_TRANSFORMS, polar, transformLandmarks } from './__fixtures__/transforms.js';
import type { ImageTransform } from './__fixtures__/transforms.js';

const MM_PER_PIXEL = 0.1;
const TENDON_LENGTH_PX = 500;

// Anatomical frame: +x cranial along the reference line, +y proximal
function tendonLandmarks(tendonAngleDegrees: number) {
    const tendonInsertion = { x: 10, y: -40 };
    return {
        referenceCaudal: { x: -30, y: 0 },
        referenceCranial: { x: 30, y: 0 },
        tendonInsertion,
        // PTA is measured from the caudal direction (180°), so the tendon points at 180° − PTA
        tendonOrigin: polar(tendonInsertion, 180 - tendonAngleDegrees, TENDON_LENGTH_PX),
    };
}

function calibrationFor(transform: ImageTransform) {
    // Scaling the image changes pixels per mm; keep the physical size constant
    return { mmPerPixel: MM_PER_PIXEL / transform.scale };
}

describe('patellarTendonAngle', () => {
    it.each([85, 90, 104.5, 112])('measures a %d° tendon in every orientation', (pta) => {
        for (const transform of IMAGE_TRANSFORMS) {
            expect(patellarTendonAngle(transformLandmarks(tendonLandmarks(pta), transform))).toBeCloseTo(pta, 9);
        }
    });

    it('rejects a tendon parallel to the reference line and coincident landmarks', () => {
        const landmarks = tendonLandmarks(100);
        expect(() => patellarTendonAngle({ ...landmarks, tendonOrigin: { x: 80, y: -40 } })).toThrow('parallel');
        expect(() => patellarTendonAngle({ ...landmarks, referenceCranial: landmarks.referenceCaudal })).toThrow('Reference line');
        expect(() => patellarTendonAngle({ ...landmarks, tendonOrigin: landmarks.tendonInsertion })).toThrow('Patellar tendon');
    });
});

describe('ttaAdvancement', () => {
    it('advances a 105° tendon to perpendicular (90°) in every orientation', () => {
        const expectedMm = TENDON_LENGTH_PX * Math.cos((75 * Math.PI) / 180) * MM_PER_PIXEL; // ≈ 12.94 mm
        for (const transform of IMAGE_TRANSFORMS) {
            const result = ttaAdvancement({ ...transformLandmarks(tendonLandmarks(105), transform), calibration: calibrationFor(transform) });
            expect(result.currentTendonAngle).toBeCloseTo(105, 9);
            expect(result.requiredAdvancementMm).toBeCloseTo(expectedMm, 9);
        }
    });

    it('reaches a custom target exactly once the insertion is moved by the result', () => {
        const landmarks = tendonLandmarks(108);
        const { requiredAdvancementMm } = ttaAdvancement({ ...landmarks, calibration: { mmPerPixel: MM_PER_PIXEL }, targetTendonAngle: 95 });
        const advanced = { ...landmarks, tendonInsertion: { x: landmarks.tendonInsertion.x + requiredAdvancementMm / MM_PER_PIXEL, y: -40 } };
        expect(patellarTendonAngle(advanced)).toBeCloseTo(95, 9);
    });

    it('reports no advancement needed (≤ 0) when the tendon is already at or past the target', () => {
        const calibration = { mmPerPixel: MM_PER_PIXEL };
        expect(ttaAdvancement({ ...tendonLandmarks(90), calibration }).requiredAdvancementMm).toBeCloseTo(0, 9);
        expect(ttaAdvancement({ ...tendonLandmarks(85), calibration }).requiredAdvancementMm).toBeLessThan(0);
    });

    it.each([0, 180, -5, NaN])('rejects target angle %d', (target) => {
        expect(() => ttaAdvancement({ ...tendonLandmarks(100), calibration: { mmPerPixel: 0.1 }, targetTendonAngle: target })).toThrow('Target tendon angle');
    });
});

describe('selectTtaCageSize', () => {
    it('defaults to rounding up within 3–15 mm cages', () => {
        expect(DEFAULT_TTA_CAGE_SIZES_MM).toEqual([3, 6, 9, 12, 15]);
        expect(selectTtaCageSize(7.2)).toBe(9);
        expect(selectTtaCageSize(6)).toBe(6);
        expect(selectTtaCageSize(0.4)).toBe(3);
    });

    it('rounds to the nearest size, ties going up', () => {
        expect(selectTtaCageSize(7.2, { rounding: 'nearest' })).toBe(6);
        expect(selectTtaCageSize(7.5, { rounding: 'nearest' })).toBe(9);
        expect(selectTtaCageSize(40, { rounding: 'nearest' })).toBe(15);
    });

    it('accepts custom, unsorted implant ranges', () => {
        expect(selectTtaCageSize(5, { availableSizesMm: [12, 4.5, 8] })).toBe(8);
    });

    it('rejects impossible requests', () => {
        expect(() => selectTtaCageSize(16)).toThrow('exceeds the largest cage (15 mm)');
        expect(() => selectTtaCageSize(0)).toThrow('positive');
        expect(() => selectTtaCageSize(NaN)).toThrow('positive');
        expect(() => selectTtaCageSize(5, { availableSizesMm: [] })).toThrow('Cage sizes');
        expect(() => selectTtaCageSize(5, { availableSizesMm: [6, -3] })).toThrow('Cage sizes');
    });
});

describe('ttaAdvancementMatrix', () => {
    it('predicts the tendon angle for each cage, smallest first', () => {
        const rows = ttaAdvancementMatrix({ ...tendonLandmarks(105), calibration: { mmPerPixel: MM_PER_PIXEL } });
        expect(rows.map((r) => r.cageSizeMm)).toEqual([3, 6, 9, 12, 15]);
        rows.slice(1).forEach((row, i) => expect(row.resultingTendonAngle).toBeLessThan(rows[i]!.resultingTendonAngle));
        rows.forEach((row) => expect(row.deviationFromTargetDegrees).toBeCloseTo(row.resultingTendonAngle - 90, 12));
        expect(rows[0]!.deviationFromTargetDegrees).toBeGreaterThan(0); // 3 mm: under-advanced
        expect(rows[4]!.deviationFromTargetDegrees).toBeLessThan(0); // 15 mm: over-advanced
    });

    it('is consistent with ttaAdvancement in every orientation', () => {
        for (const transform of IMAGE_TRANSFORMS) {
            const landmarks = { ...transformLandmarks(tendonLandmarks(103), transform), calibration: calibrationFor(transform) };
            const { requiredAdvancementMm } = ttaAdvancement({ ...landmarks, targetTendonAngle: 92 });
            const [row] = ttaAdvancementMatrix({ ...landmarks, targetTendonAngle: 92, availableSizesMm: [requiredAdvancementMm] });
            expect(row!.resultingTendonAngle).toBeCloseTo(92, 9);
            expect(row!.deviationFromTargetDegrees).toBeCloseTo(0, 9);
        }
    });

    it('rejects an invalid target', () => {
        expect(() => ttaAdvancementMatrix({ ...tendonLandmarks(100), calibration: { mmPerPixel: 0.1 }, targetTendonAngle: 200 })).toThrow('Target tendon angle');
    });
});
