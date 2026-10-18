import { describe, expect, it } from 'vitest';
import { polar } from '../math/__fixtures__/transforms.js';
import { computePlanResults, evaluatePlanMeasurements, resolvePlanCalibration, summarizeEvaluation } from './plan.js';
import type { PlanMeasurement } from './plan.js';
import { MeasurementType } from './types.js';

const marker = (id: string, radius: number): PlanMeasurement => ({
    id,
    type: MeasurementType.CALIBRATION_MARKER,
    points: { markerOutline: [0, 120, 240].map((deg) => polar({ x: 500, y: 500 }, deg, radius)) },
    parameters: { markerDiameterMm: 25 },
});
const distance: PlanMeasurement = {
    id: 'd',
    type: MeasurementType.DISTANCE,
    points: { start: [{ x: 0, y: 0 }], end: [{ x: 300, y: 400 }] },
    parameters: {},
};
const spacing = { mmPerPixel: 0.2, source: 'PixelSpacing' as const };

describe('resolvePlanCalibration', () => {
    it('prefers the latest complete calibration measurement, then the image spacing', () => {
        expect(resolvePlanCalibration([])).toEqual({});
        expect(resolvePlanCalibration([distance], spacing)).toEqual({ calibration: { mmPerPixel: 0.2 }, source: 'DICOM PixelSpacing' });

        const resolved = resolvePlanCalibration([marker('a', 50), distance, marker('b', 100)], spacing);
        expect(resolved.source).toBe('Calibration (marker ball)');
        expect(resolved.calibration?.mmPerPixel).toBeCloseTo(0.125, 9); // the later, 100 px marker

        const incomplete: PlanMeasurement = { ...marker('c', 50), points: { markerOutline: [{ x: 1, y: 1 }] } };
        expect(resolvePlanCalibration([incomplete], null)).toEqual({});
    });
});

describe('plan evaluation', () => {
    it('evaluates every measurement with the given calibration', () => {
        const [{ evaluation }] = evaluatePlanMeasurements([distance], { mmPerPixel: 0.1 });
        expect(evaluation).toMatchObject({ status: 'complete', values: [{ value: 50, unit: 'mm' }] });
    });

    it('summarizes complete, invalid and incomplete measurements', () => {
        const coincident: PlanMeasurement = { ...distance, id: 'x', points: { start: [{ x: 1, y: 1 }], end: [{ x: 1, y: 1 }] } };
        const partial: PlanMeasurement = { ...distance, id: 'p', points: { start: [{ x: 1, y: 1 }] } };
        const { calibration, results } = computePlanResults([marker('m', 50), distance, coincident, partial], spacing);

        expect(calibration?.source).toBe('Calibration (marker ball)');
        expect(calibration?.mmPerPixel).toBeCloseTo(0.25, 9);
        expect(results.map((r) => [r.id, r.status])).toEqual([
            ['m', 'complete'],
            ['d', 'complete'],
            ['x', 'invalid'],
            ['p', 'incomplete'],
        ]);
        expect(results[1]!.values[0]).toMatchObject({ value: expect.closeTo(125, 9), unit: 'mm' });
        expect(results[2]!.message).toContain('must not coincide');
        expect(results[3]!.message).toBe('Missing landmark: End');
        expect(computePlanResults([distance]).calibration).toBeNull();
    });

    it('keeps summaries free of overlay geometry', () => {
        const [{ measurement, evaluation }] = evaluatePlanMeasurements([distance], undefined);
        expect(Object.keys(summarizeEvaluation(measurement, evaluation)).sort()).toEqual(['id', 'status', 'type', 'values', 'warnings']);
    });
});
