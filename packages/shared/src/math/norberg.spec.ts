import { describe, expect, it } from 'vitest';
import {
    bilateralNorbergAngles,
    isNorbergAngleWithinNormalLimits,
    NORBERG_NORMAL_THRESHOLD_DEGREES,
    norbergAngle,
} from './norberg.js';
import { fitCircle } from './geometry.js';
import { IMAGE_TRANSFORMS, polar, transformLandmarks } from './__fixtures__/transforms.js';

// Ventrodorsal frame: right femoral head at the origin, left one 180 px to the +x side, +y cranial
function hipLandmarks(rightAngle: number, leftAngle: number) {
    const rightHead = { x: 0, y: 0 };
    const leftHead = { x: 180, y: 0 };
    return {
        rightHead,
        rightRim: polar(rightHead, rightAngle, 60), // measured from the direction of the left head (0°)
        leftHead,
        leftRim: polar(leftHead, 180 - leftAngle, 60), // mirrored: measured from 180°
    };
}

describe('norbergAngle', () => {
    it('measures both hips in every orientation', () => {
        for (const transform of IMAGE_TRANSFORMS) {
            const p = transformLandmarks(hipLandmarks(98, 110), transform);
            const angles = bilateralNorbergAngles(
                { femoralHeadCenter: p.leftHead, craniolateralAcetabularRim: p.leftRim },
                { femoralHeadCenter: p.rightHead, craniolateralAcetabularRim: p.rightRim },
            );
            expect(angles.left).toBeCloseTo(110, 9);
            expect(angles.right).toBeCloseTo(98, 9);
        }
    });

    it('works with head centres fitted from outline clicks', () => {
        const p = hipLandmarks(105, 105);
        const outline = [190, 230, 270, 310, 350].map((deg) => polar(p.rightHead, deg, 45));
        const angle = norbergAngle(
            { femoralHeadCenter: fitCircle(outline).center, craniolateralAcetabularRim: p.rightRim },
            p.leftHead,
        );
        expect(angle).toBeCloseTo(105, 9);
    });

    it('rejects coincident landmarks', () => {
        const p = hipLandmarks(105, 105);
        expect(() => norbergAngle({ femoralHeadCenter: p.rightHead, craniolateralAcetabularRim: p.rightRim }, p.rightHead)).toThrow('femoral head centres');
        expect(() => norbergAngle({ femoralHeadCenter: p.rightHead, craniolateralAcetabularRim: p.rightHead }, p.leftHead)).toThrow('acetabular rim');
    });
});

describe('isNorbergAngleWithinNormalLimits', () => {
    it('uses 105° by default', () => {
        expect(NORBERG_NORMAL_THRESHOLD_DEGREES).toBe(105);
        expect(isNorbergAngleWithinNormalLimits(105)).toBe(true);
        expect(isNorbergAngleWithinNormalLimits(104.9)).toBe(false);
    });

    it('accepts a custom threshold and rejects non-finite input', () => {
        expect(isNorbergAngleWithinNormalLimits(101, 100)).toBe(true);
        expect(() => isNorbergAngleWithinNormalLimits(NaN)).toThrow(RangeError);
        expect(() => isNorbergAngleWithinNormalLimits(105, NaN)).toThrow(RangeError);
    });
});
