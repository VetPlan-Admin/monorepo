import { angleBetweenVectors, vectorBetween } from './geometry.js';
import type { Point2D } from './geometry.js';

/** One hip on a ventrodorsal, hip-extended radiograph. */
export interface HipLandmarks {
    /** Centre of the femoral head. Use `fitCircle` on points around the head outline. */
    femoralHeadCenter: Point2D;
    /** Craniolateral (cranial effective) rim of the acetabulum. */
    craniolateralAcetabularRim: Point2D;
}

/**
 * Norberg angle of one hip, in degrees: at the femoral head centre, the angle between the line
 * to the contralateral femoral head centre and the line to the craniolateral acetabular rim.
 * Lower values indicate more subluxation.
 */
export function norbergAngle(hip: HipLandmarks, contralateralFemoralHeadCenter: Point2D): number {
    const interHeadLine = vectorBetween(hip.femoralHeadCenter, contralateralFemoralHeadCenter, 'Line between femoral head centres');
    const rimLine = vectorBetween(hip.femoralHeadCenter, hip.craniolateralAcetabularRim, 'Line to the acetabular rim');
    return angleBetweenVectors(interHeadLine, rimLine);
}

export interface BilateralNorbergAngles {
    left: number;
    right: number;
}

export function bilateralNorbergAngles(left: HipLandmarks, right: HipLandmarks): BilateralNorbergAngles {
    return {
        left: norbergAngle(left, right.femoralHeadCenter),
        right: norbergAngle(right, left.femoralHeadCenter),
    };
}

/** Commonly used lower limit of a normal Norberg angle, in degrees. */
export const NORBERG_NORMAL_THRESHOLD_DEGREES = 105;

/**
 * True when the angle is at or above the threshold (default 105°). A screening aid only:
 * hip dysplasia grading schemes (e.g. FCI) also weigh congruency and degenerative changes.
 */
export function isNorbergAngleWithinNormalLimits(
    angleDegrees: number,
    thresholdDegrees: number = NORBERG_NORMAL_THRESHOLD_DEGREES,
): boolean {
    if (!Number.isFinite(angleDegrees) || !Number.isFinite(thresholdDegrees)) {
        throw new RangeError('Norberg angle and threshold must be finite numbers of degrees');
    }
    return angleDegrees >= thresholdDegrees;
}
