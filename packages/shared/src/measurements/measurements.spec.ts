import { describe, expect, it } from 'vitest';
import { polar } from '../math/__fixtures__/transforms.js';
import type { Point2D } from '../math/geometry.js';
import {
    defaultParameters,
    evaluateMeasurement,
    evaluateMeasurementWith,
    getMeasurementDefinition,
    nextLandmarkSlot,
    resolveParameters,
} from './evaluate.js';
import { formatMeasurementValue } from './format.js';
import { MeasurementType } from './types.js';
import type { MeasurementDefinition, MeasurementEvaluation, OverlayShape } from './types.js';
import { tryOrWarn } from './utils.js';

type Complete = Extract<MeasurementEvaluation, { status: 'complete' }>;

function expectComplete(evaluation: MeasurementEvaluation): Complete {
    expect(evaluation.status).toBe('complete');
    return evaluation as Complete;
}

function valueOf(evaluation: Complete, key: string): number | undefined {
    return evaluation.values.find((v) => v.key === key)?.value;
}

function shapes(evaluation: MeasurementEvaluation, kind: OverlayShape['kind']): OverlayShape[] {
    return evaluation.overlay.filter((s) => s.kind === kind);
}

const one = (p: Point2D) => [p];

// Mediolateral tibia, +x cranial, +y proximal (as in the TPLO math specs)
function tpaPoints(tpa: number) {
    const plateauCaudal = { x: -22, y: 676 };
    return {
        plateauCaudal: one(plateauCaudal),
        plateauCranial: one(polar(plateauCaudal, tpa, 44)),
        intercondylarEminence: one({ x: 0, y: 685 }),
        talusCenter: one({ x: 0, y: 0 }),
    };
}

// Stifle at 135°, +x cranial along the reference line, +y proximal
function ttaPoints(pta: number) {
    const insertion = { x: 10, y: -40 };
    return {
        referenceCaudal: one({ x: -30, y: 0 }),
        referenceCranial: one({ x: 30, y: 0 }),
        tendonOrigin: one(polar(insertion, 180 - pta, 500)),
        tendonInsertion: one(insertion),
    };
}

describe('formatMeasurementValue', () => {
    it('formats each unit', () => {
        expect(formatMeasurementValue({ value: 24.46, unit: '°', decimals: 1 })).toBe('24.5°');
        expect(formatMeasurementValue({ value: 12.94, unit: 'mm', decimals: 1 })).toBe('12.9 mm');
        expect(formatMeasurementValue({ value: 0.125, unit: 'mm/px', decimals: 4 })).toBe('0.1250 mm/px');
    });
});

describe('definitions & parameters', () => {
    it('looks up every measurement type and rejects unknown ones', () => {
        for (const type of Object.values(MeasurementType)) {
            expect(getMeasurementDefinition(type).type).toBe(type);
        }
        expect(() => getMeasurementDefinition('BOGUS' as MeasurementType)).toThrow('Unknown measurement type');
    });

    it('resolves defaults, overrides and ranges', () => {
        const tpa = getMeasurementDefinition(MeasurementType.TIBIAL_PLATEAU_ANGLE);
        expect(defaultParameters(tpa)).toEqual({ targetPlateauAngle: 5, sawBladeRadiusMm: 24 });
        expect(resolveParameters(tpa, { sawBladeRadiusMm: 30, unknown: 1 })).toEqual({ targetPlateauAngle: 5, sawBladeRadiusMm: 30 });
        expect(() => resolveParameters(tpa, { sawBladeRadiusMm: 100 })).toThrow('Saw blade radius must be between 5 and 40 mm');
        expect(() => resolveParameters(tpa, { targetPlateauAngle: NaN })).toThrow('Target TPA');
    });

    it('walks landmark slots in order, including 3-point outlines', () => {
        const norberg = getMeasurementDefinition(MeasurementType.NORBERG_ANGLE);
        expect(nextLandmarkSlot(norberg, {})).toMatchObject({ landmark: { key: 'rightHeadOutline' }, pointIndex: 0 });
        expect(nextLandmarkSlot(norberg, { rightHeadOutline: [{ x: 0, y: 0 }, { x: 1, y: 0 }] })).toMatchObject({ pointIndex: 2 });
        const outline = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
        expect(nextLandmarkSlot(norberg, { rightHeadOutline: outline })).toMatchObject({ landmark: { key: 'rightRim' }, pointIndex: 0 });
        expect(
            nextLandmarkSlot(norberg, { rightHeadOutline: outline, rightRim: [outline[0]!], leftHeadOutline: outline, leftRim: [outline[0]!] }),
        ).toBeUndefined();
    });
});

describe('evaluateMeasurement: placement', () => {
    it('draws construction lines as soon as both ends exist', () => {
        const points = tpaPoints(20);
        const first = evaluateMeasurement(MeasurementType.TIBIAL_PLATEAU_ANGLE, { plateauCaudal: points.plateauCaudal });
        expect(first).toMatchObject({ status: 'incomplete', nextLandmark: { key: 'plateauCranial' }, nextPointIndex: 0 });
        expect(first.overlay).toHaveLength(0);

        const second = evaluateMeasurement(MeasurementType.TIBIAL_PLATEAU_ANGLE, { plateauCaudal: points.plateauCaudal, plateauCranial: points.plateauCranial });
        expect(shapes(second, 'segment')).toHaveLength(1);
    });

    it('fits outline circles once three points exist, and skips collinear ones', () => {
        const circle = [{ x: 10, y: 0 }, { x: -10, y: 0 }, { x: 0, y: 10 }];
        expect(shapes(evaluateMeasurement(MeasurementType.CALIBRATION_MARKER, { markerOutline: circle.slice(0, 2) }), 'circle')).toHaveLength(0);
        expect(evaluateMeasurement(MeasurementType.NORBERG_ANGLE, { rightHeadOutline: circle }).overlay).toEqual([
            { kind: 'circle', center: { x: 0, y: 0 }, radius: 10, emphasis: 'secondary' },
        ]);

        const collinear = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }];
        const evaluation = evaluateMeasurement(MeasurementType.CALIBRATION_MARKER, { markerOutline: collinear });
        expect(evaluation).toMatchObject({ status: 'invalid', message: 'Circle points must not be collinear', overlay: [] });
    });

    it('ignores extra points beyond a landmark’s count', () => {
        const points = { ...tpaPoints(20), talusCenter: [{ x: 0, y: 0 }, { x: 999, y: 999 }] };
        expect(valueOf(expectComplete(evaluateMeasurement(MeasurementType.TIBIAL_PLATEAU_ANGLE, points)), 'tpa')).toBeCloseTo(20, 9);
    });

    it('reports invalid geometry and parameters without throwing', () => {
        const points = tpaPoints(20);
        expect(evaluateMeasurement(MeasurementType.TIBIAL_PLATEAU_ANGLE, { ...points, plateauCranial: points.plateauCaudal })).toMatchObject({
            status: 'invalid',
            message: 'Tibial plateau line: the two landmarks must not coincide',
        });
        expect(evaluateMeasurement(MeasurementType.TIBIAL_PLATEAU_ANGLE, points, { targetPlateauAngle: 50 })).toMatchObject({
            status: 'invalid',
            message: expect.stringContaining('Target TPA'),
        });
    });

    it('propagates programming errors', () => {
        const broken: MeasurementDefinition = {
            ...getMeasurementDefinition(MeasurementType.DISTANCE),
            compute: () => {
                throw new TypeError('bug');
            },
        };
        expect(() => evaluateMeasurementWith(broken, { start: [{ x: 0, y: 0 }], end: [{ x: 1, y: 1 }] })).toThrow(TypeError);
        expect(() => tryOrWarn(() => { throw new TypeError('bug'); }, [])).toThrow(TypeError);
    });
});

describe('TPLO protocols', () => {
    it('computes TPA, rotation and chord with overlays', () => {
        const evaluation = expectComplete(evaluateMeasurement(MeasurementType.TIBIAL_PLATEAU_ANGLE, tpaPoints(25), { sawBladeRadiusMm: 24 }));
        expect(valueOf(evaluation, 'tpa')).toBeCloseTo(25, 9);
        expect(valueOf(evaluation, 'rotation')).toBeCloseTo(20, 9);
        expect(valueOf(evaluation, 'chord')).toBeCloseTo(2 * 24 * Math.sin((10 * Math.PI) / 180), 9);
        expect(shapes(evaluation, 'segment').map((s) => (s as { emphasis: string }).emphasis)).toEqual(['primary', 'secondary', 'guide']);
        expect(shapes(evaluation, 'label')).toEqual([expect.objectContaining({ text: 'TPA 25.0°' })]);
        expect(evaluation.warnings).toEqual([]);
    });

    it('warns instead of planning when the TPA is already below the target', () => {
        const evaluation = expectComplete(evaluateMeasurement(MeasurementType.TIBIAL_PLATEAU_ANGLE, tpaPoints(3)));
        expect(evaluation.values.map((v) => v.key)).toEqual(['tpa']);
        expect(evaluation.warnings).toEqual([expect.stringContaining('already below the target')]);
    });

    it('computes mMPTA', () => {
        const plateauLateral = { x: -25, y: 300 };
        const evaluation = expectComplete(
            evaluateMeasurement(MeasurementType.MEDIAL_PROXIMAL_TIBIAL_ANGLE, {
                plateauLateral: one(plateauLateral),
                plateauMedial: one(polar(plateauLateral, 3.5, 50)),
                proximalAxisPoint: one({ x: 0, y: 300 }),
                distalAxisPoint: one({ x: 0, y: 0 }),
            }),
        );
        expect(valueOf(evaluation, 'mmpta')).toBeCloseTo(93.5, 9);
        expect(shapes(evaluation, 'label')).toEqual([expect.objectContaining({ text: 'mMPTA 93.5°' })]);
    });
});

describe('TTA protocol', () => {
    const calibration = { mmPerPixel: 0.1 };

    it('without calibration: PTA, planned tendon line and a calibration warning', () => {
        const evaluation = expectComplete(evaluateMeasurement(MeasurementType.TTA_ADVANCEMENT, ttaPoints(105)));
        expect(valueOf(evaluation, 'pta')).toBeCloseTo(105, 9);
        expect(evaluation.values).toHaveLength(1);
        expect(shapes(evaluation, 'arrow')).toHaveLength(1);
        expect(evaluation.warnings).toEqual([expect.stringContaining('Calibrate the image')]);
    });

    it('with calibration: advancement, cage and predicted PTA', () => {
        const evaluation = expectComplete(evaluateMeasurement(MeasurementType.TTA_ADVANCEMENT, ttaPoints(105), {}, calibration));
        expect(valueOf(evaluation, 'advancement')).toBeCloseTo(500 * Math.cos((75 * Math.PI) / 180) * 0.1, 9); // ≈ 12.9 mm
        expect(valueOf(evaluation, 'cage')).toBe(15);
        expect(valueOf(evaluation, 'predictedPta')!).toBeLessThan(90);
        // The arrow ends where the insertion must move: on the target tendon line
        const arrow = shapes(evaluation, 'arrow')[0] as { to: Point2D };
        expect(arrow.to.x).toBeCloseTo(10 + 129.409522551, 6);
    });

    it('needs no advancement for a tendon already at the target', () => {
        const evaluation = expectComplete(evaluateMeasurement(MeasurementType.TTA_ADVANCEMENT, ttaPoints(88), {}, calibration));
        expect(valueOf(evaluation, 'advancement')!).toBeLessThan(0);
        expect(valueOf(evaluation, 'cage')).toBeUndefined();
        expect(shapes(evaluation, 'arrow')).toHaveLength(0);
        expect(evaluation.warnings).toEqual([expect.stringContaining('No advancement needed')]);
    });

    it('warns when no cage is large enough', () => {
        const evaluation = expectComplete(evaluateMeasurement(MeasurementType.TTA_ADVANCEMENT, ttaPoints(115), {}, calibration));
        expect(valueOf(evaluation, 'cage')).toBeUndefined();
        expect(evaluation.warnings).toEqual([expect.stringContaining('exceeds the largest cage')]);
    });
});

describe('Norberg protocol', () => {
    it('measures both hips and flags those below the threshold', () => {
        const rightHead = { x: 0, y: 0 };
        const leftHead = { x: 180, y: 0 };
        const outline = (center: Point2D) => [200, 260, 320].map((deg) => polar(center, deg, 40));
        const evaluation = expectComplete(
            evaluateMeasurement(MeasurementType.NORBERG_ANGLE, {
                rightHeadOutline: outline(rightHead),
                rightRim: one(polar(rightHead, 98, 60)),
                leftHeadOutline: outline(leftHead),
                leftRim: one(polar(leftHead, 180 - 110, 60)),
            }),
        );
        expect(evaluation.values).toEqual([
            expect.objectContaining({ key: 'rightNorberg', value: expect.closeTo(98, 9), assessment: 'outside-limits' }),
            expect.objectContaining({ key: 'leftNorberg', value: expect.closeTo(110, 9), assessment: 'within-limits' }),
        ]);
        expect(shapes(evaluation, 'circle')).toHaveLength(2);
        expect(shapes(evaluation, 'label').map((l) => (l as { text: string }).text)).toEqual(['NA 98.0°', 'NA 110.0°']);
    });
});

describe('calibration protocols', () => {
    it('derives a calibration from a marker ball', () => {
        const outline = [0, 120, 240].map((deg) => polar({ x: 500, y: 500 }, deg, 50));
        const evaluation = expectComplete(evaluateMeasurement(MeasurementType.CALIBRATION_MARKER, { markerOutline: outline }));
        expect(evaluation.calibration?.mmPerPixel).toBeCloseTo(0.25, 9);
        expect(shapes(evaluation, 'label')).toEqual([expect.objectContaining({ text: '⌀ 25 mm' })]);
    });

    it('derives a calibration from a known length', () => {
        const evaluation = expectComplete(
            evaluateMeasurement(MeasurementType.CALIBRATION_LENGTH, { lengthStart: one({ x: 0, y: 0 }), lengthEnd: one({ x: 300, y: 400 }) }, { knownLengthMm: 50 }),
        );
        expect(evaluation.calibration?.mmPerPixel).toBeCloseTo(0.1, 12);
        expect(valueOf(evaluation, 'mmPerPixel')).toBeCloseTo(0.1, 12);
    });
});

describe('generic tools', () => {
    const start = one({ x: 0, y: 0 });
    const end = one({ x: 300, y: 400 });

    it('measures distance in pixels or millimetres', () => {
        const raw = expectComplete(evaluateMeasurement(MeasurementType.DISTANCE, { start, end }));
        expect(raw.values[0]).toMatchObject({ value: 500, unit: 'px' });
        expect(raw.warnings).toHaveLength(1);
        expect(shapes(raw, 'label')).toEqual([expect.objectContaining({ text: '500 px' })]);

        const calibrated = expectComplete(evaluateMeasurement(MeasurementType.DISTANCE, { start, end }, {}, { mmPerPixel: 0.1 }));
        expect(calibrated.values[0]).toMatchObject({ value: 50, unit: 'mm' });
        expect(calibrated.warnings).toEqual([]);

        expect(evaluateMeasurement(MeasurementType.DISTANCE, { start, end: start })).toMatchObject({ status: 'invalid' });
    });

    it('reports the acute angle between two lines', () => {
        const lines = (degrees: number) => ({
            firstStart: one({ x: 0, y: 0 }),
            firstEnd: one({ x: 100, y: 0 }),
            secondStart: one({ x: 0, y: 50 }),
            secondEnd: one(polar({ x: 0, y: 50 }, degrees, 100)),
        });
        expect(valueOf(expectComplete(evaluateMeasurement(MeasurementType.ANGLE_BETWEEN_LINES, lines(30))), 'angle')).toBeCloseTo(30, 9);
        expect(valueOf(expectComplete(evaluateMeasurement(MeasurementType.ANGLE_BETWEEN_LINES, lines(150))), 'angle')).toBeCloseTo(30, 9);
        expect(evaluateMeasurement(MeasurementType.ANGLE_BETWEEN_LINES, { ...lines(30), firstEnd: one({ x: 0, y: 0 }) })).toMatchObject({
            status: 'invalid',
            message: expect.stringContaining('Line 1'),
        });
    });
});
