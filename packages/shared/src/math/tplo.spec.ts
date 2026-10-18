import { describe, expect, it } from 'vitest';
import {
    DEFAULT_TPLO_TARGET_PLATEAU_ANGLE,
    mechanicalMedialProximalTibialAngle,
    tibialPlateauAngle,
    tploRotationPlan,
} from './tplo.js';
import { IMAGE_TRANSFORMS, polar, transformLandmarks } from './__fixtures__/transforms.js';

// Anatomical frame for construction: +x cranial (or medial), +y proximal
function plateauLandmarks(tpaDegrees: number) {
    const plateauCaudal = { x: -22, y: 196 };
    return {
        plateauCaudal,
        plateauCranial: polar(plateauCaudal, tpaDegrees, 44),
        intercondylarEminence: { x: 0, y: 205 },
        talusCenter: { x: 3, y: -480 }, // not directly below: the axis itself is tilted
    };
}

function tiltedPlateauLandmarks(tpaDegrees: number) {
    // Same TPA, but measured against an axis tilted by atan(3/685); rebuild the plateau relative to it
    const talusCenter = { x: 0, y: 0 };
    const intercondylarEminence = { x: 0, y: 685 };
    const plateauCaudal = { x: -22, y: 676 };
    return { plateauCaudal, plateauCranial: polar(plateauCaudal, tpaDegrees, 44), intercondylarEminence, talusCenter };
}

describe('tibialPlateauAngle', () => {
    it.each([-6, 0, 18, 24.5, 35])('measures a %d° plateau in every image orientation', (tpa) => {
        for (const transform of IMAGE_TRANSFORMS) {
            expect(tibialPlateauAngle(transformLandmarks(tiltedPlateauLandmarks(tpa), transform))).toBeCloseTo(tpa, 9);
        }
    });

    it('measures relative to the functional axis, not the image vertical', () => {
        // The axis leans 3 px over 685 px; the plateau is built at 20° to the image horizontal
        const tilt = (Math.atan2(3, 685) * 180) / Math.PI;
        expect(tibialPlateauAngle(plateauLandmarks(20))).toBeCloseTo(20 - tilt, 9);
    });

    it('rejects coincident landmarks', () => {
        const landmarks = tiltedPlateauLandmarks(20);
        expect(() => tibialPlateauAngle({ ...landmarks, plateauCranial: landmarks.plateauCaudal })).toThrow('Tibial plateau line');
        expect(() => tibialPlateauAngle({ ...landmarks, talusCenter: landmarks.intercondylarEminence })).toThrow('Tibial functional axis');
    });
});

describe('mechanicalMedialProximalTibialAngle', () => {
    function frontalLandmarks(medialRiseDegrees: number) {
        const plateauLateral = { x: -25, y: 300 };
        return {
            plateauLateral,
            plateauMedial: polar(plateauLateral, medialRiseDegrees, 50),
            proximalAxisPoint: { x: 0, y: 300 },
            distalAxisPoint: { x: 0, y: 0 },
        };
    }

    it.each([
        [0, 90],
        [3.5, 93.5],
        [-3, 87],
    ])('a joint line rising %d° medially gives mMPTA %d°', (rise, expected) => {
        for (const transform of IMAGE_TRANSFORMS) {
            expect(mechanicalMedialProximalTibialAngle(transformLandmarks(frontalLandmarks(rise), transform))).toBeCloseTo(expected, 9);
        }
    });

    it('rejects coincident landmarks', () => {
        const landmarks = frontalLandmarks(0);
        expect(() => mechanicalMedialProximalTibialAngle({ ...landmarks, plateauMedial: landmarks.plateauLateral })).toThrow(RangeError);
        expect(() => mechanicalMedialProximalTibialAngle({ ...landmarks, distalAxisPoint: landmarks.proximalAxisPoint })).toThrow(RangeError);
    });
});

describe('tploRotationPlan', () => {
    it('rotates down to the default 5° target', () => {
        const plan = tploRotationPlan({ tibialPlateauAngle: 25, sawBladeRadiusMm: 24 });
        expect(DEFAULT_TPLO_TARGET_PLATEAU_ANGLE).toBe(5);
        expect(plan.rotationDegrees).toBe(20);
        expect(plan.chordLengthMm).toBeCloseTo(2 * 24 * Math.sin((10 * Math.PI) / 180), 12); // ≈ 8.335
        expect(plan.arcLengthMm).toBeCloseTo((24 * 20 * Math.PI) / 180, 12); // ≈ 8.378
        expect(plan.chordLengthMm).toBeLessThan(plan.arcLengthMm);
    });

    it('honours a custom target and a zero rotation', () => {
        expect(tploRotationPlan({ tibialPlateauAngle: 26.5, targetPlateauAngle: 6.5, sawBladeRadiusMm: 30 }).rotationDegrees).toBeCloseTo(20, 12);
        expect(tploRotationPlan({ tibialPlateauAngle: 5, sawBladeRadiusMm: 18 })).toEqual({ rotationDegrees: 0, chordLengthMm: 0, arcLengthMm: 0 });
    });

    it('rejects impossible plans', () => {
        expect(() => tploRotationPlan({ tibialPlateauAngle: 3, sawBladeRadiusMm: 24 })).toThrow('already below the target');
        expect(() => tploRotationPlan({ tibialPlateauAngle: 25, sawBladeRadiusMm: 0 })).toThrow('Saw blade radius');
        expect(() => tploRotationPlan({ tibialPlateauAngle: 25, sawBladeRadiusMm: NaN })).toThrow('Saw blade radius');
        expect(() => tploRotationPlan({ tibialPlateauAngle: NaN, sawBladeRadiusMm: 24 })).toThrow('finite');
        expect(() => tploRotationPlan({ tibialPlateauAngle: 25, targetPlateauAngle: Infinity, sawBladeRadiusMm: 24 })).toThrow('finite');
    });
});
