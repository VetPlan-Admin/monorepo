import { millimetresToPixels, pixelsToMillimetres } from './calibration.js';
import type { Calibration } from './calibration.js';
import { add, angleBetweenVectors, dot, normalize, scale, subtract, toRadians, vectorBetween } from './geometry.js';
import type { Point2D } from './geometry.js';

/**
 * Landmarks on a mediolateral radiograph with the stifle at about 135° of extension.
 *
 * The reference line is either the tibial plateau line or the femorotibial common tangent;
 * give its caudal point first so the cranial direction is known.
 */
export interface PatellarTendonInput {
    referenceCaudal: Point2D;
    referenceCranial: Point2D;
    /** Origin of the patellar ligament at the distal pole of the patella. */
    tendonOrigin: Point2D;
    /** Insertion of the patellar ligament on the tibial tuberosity. */
    tendonInsertion: Point2D;
}

/** The goal of TTA: a patellar tendon perpendicular to the reference line. */
export const DEFAULT_TTA_TARGET_TENDON_ANGLE = 90;

/** Typical TTA cage widths in millimetres. Confirm against the implant system in use. */
export const DEFAULT_TTA_CAGE_SIZES_MM: readonly number[] = [3, 6, 9, 12, 15];

interface TendonFrame {
    /** Unit vector along the reference line, pointing cranially. */
    cranial: Point2D;
    /** Unit normal to the reference line, pointing from the insertion towards the patella. */
    proximal: Point2D;
    origin: Point2D;
    insertion: Point2D;
}

function tendonFrame(input: PatellarTendonInput): TendonFrame {
    const cranial = normalize(vectorBetween(input.referenceCaudal, input.referenceCranial, 'Reference line'));
    const tendon = vectorBetween(input.tendonInsertion, input.tendonOrigin, 'Patellar tendon');
    let proximal = { x: -cranial.y, y: cranial.x };
    if (dot(tendon, proximal) < 0) {
        proximal = scale(proximal, -1);
    }
    if (dot(tendon, proximal) === 0) {
        throw new RangeError('The patellar tendon must not lie parallel to the reference line');
    }
    return { cranial, proximal, origin: input.tendonOrigin, insertion: input.tendonInsertion };
}

function tendonAngle(frame: TendonFrame, insertion: Point2D): number {
    // Angle on the caudal side: > 90° when the patella sits cranial to the insertion
    return angleBetweenVectors(subtract(frame.origin, insertion), scale(frame.cranial, -1));
}

/** Patellar tendon angle (PTA) relative to the reference line, in degrees. */
export function patellarTendonAngle(input: PatellarTendonInput): number {
    return tendonAngle(tendonFrame(input), input.tendonInsertion);
}

function assertTargetAngle(target: number): void {
    if (!Number.isFinite(target) || target <= 0 || target >= 180) {
        throw new RangeError('Target tendon angle must be between 0° and 180° (exclusive)');
    }
}

export interface TtaAdvancementInput extends PatellarTendonInput {
    calibration: Calibration;
    /** Desired post-operative tendon angle in degrees. Defaults to 90°. */
    targetTendonAngle?: number;
}

export interface TtaAdvancement {
    currentTendonAngle: number;
    /** Cranial advancement of the tuberosity needed to reach the target. ≤ 0 means none is needed. */
    requiredAdvancementMm: number;
}

/**
 * Conventional (linear) TTA planning: how far the tibial tuberosity must move cranially,
 * parallel to the reference line, for the patellar tendon to reach the target angle.
 *
 * Model assumptions: the tuberosity translates parallel to the reference line, the patella does
 * not move, and the cage width equals the advancement at the tendon insertion. Hinged techniques
 * (e.g. Modified Maquet, TTA Rapid) advance by rotation and need a different correction.
 */
export function ttaAdvancement(input: TtaAdvancementInput): TtaAdvancement {
    const target = input.targetTendonAngle ?? DEFAULT_TTA_TARGET_TENDON_ANGLE;
    assertTargetAngle(target);
    const frame = tendonFrame(input);

    const tendon = subtract(frame.origin, frame.insertion);
    const along = dot(tendon, frame.cranial);
    const height = dot(tendon, frame.proximal);
    // New insertion B' = B + s·cranial must satisfy angle(origin − B', −cranial) = target:
    // s = along + height · cot(target)
    const advancementPx = along + height / Math.tan(toRadians(target));

    return {
        currentTendonAngle: tendonAngle(frame, frame.insertion),
        requiredAdvancementMm: pixelsToMillimetres(advancementPx, input.calibration),
    };
}

export type CageRounding = 'up' | 'nearest';

export interface CageSelectionOptions {
    /** Available cage widths in millimetres. Defaults to 3, 6, 9, 12 and 15 mm. */
    availableSizesMm?: readonly number[];
    /** `up` (default): smallest cage at least as wide as needed. `nearest`: closest width, ties go up. */
    rounding?: CageRounding;
}

function validatedSizes(sizes: readonly number[]): number[] {
    if (sizes.length === 0 || sizes.some((s) => !Number.isFinite(s) || s <= 0)) {
        throw new RangeError('Cage sizes must be a non-empty list of positive millimetre values');
    }
    return [...sizes].sort((a, b) => a - b);
}

/** Picks a cage width for a required advancement (in millimetres). */
export function selectTtaCageSize(requiredAdvancementMm: number, options: CageSelectionOptions = {}): number {
    if (!Number.isFinite(requiredAdvancementMm) || requiredAdvancementMm <= 0) {
        throw new RangeError('Required advancement must be a positive number of millimetres');
    }
    const sizes = validatedSizes(options.availableSizesMm ?? DEFAULT_TTA_CAGE_SIZES_MM);

    if ((options.rounding ?? 'up') === 'up') {
        const size = sizes.find((s) => s >= requiredAdvancementMm);
        if (size === undefined) {
            throw new RangeError(
                `Required advancement (${requiredAdvancementMm.toFixed(1)} mm) exceeds the largest cage (${sizes.at(-1)} mm)`,
            );
        }
        return size;
    }

    return sizes.reduce((best, s) =>
        Math.abs(s - requiredAdvancementMm) <= Math.abs(best - requiredAdvancementMm) ? s : best,
    );
}

export interface TtaMatrixInput extends PatellarTendonInput {
    calibration: Calibration;
    availableSizesMm?: readonly number[];
    targetTendonAngle?: number;
}

export interface TtaMatrixRow {
    cageSizeMm: number;
    /** Predicted post-operative tendon angle with this cage (same linear model). */
    resultingTendonAngle: number;
    /** resultingTendonAngle − target: positive = under-advanced, negative = over-advanced. */
    deviationFromTargetDegrees: number;
}

/** Predicted tendon angle for every available cage size, smallest cage first. */
export function ttaAdvancementMatrix(input: TtaMatrixInput): TtaMatrixRow[] {
    const target = input.targetTendonAngle ?? DEFAULT_TTA_TARGET_TENDON_ANGLE;
    assertTargetAngle(target);
    const frame = tendonFrame(input);

    return validatedSizes(input.availableSizesMm ?? DEFAULT_TTA_CAGE_SIZES_MM).map((cageSizeMm) => {
        const shift = scale(frame.cranial, millimetresToPixels(cageSizeMm, input.calibration));
        const resultingTendonAngle = tendonAngle(frame, add(frame.insertion, shift));
        return { cageSizeMm, resultingTendonAngle, deviationFromTargetDegrees: resultingTendonAngle - target };
    });
}
