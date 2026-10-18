import { angleBetweenVectors, toRadians, vectorBetween } from './geometry.js';
import type { Point2D } from './geometry.js';

/** Landmarks on a mediolateral radiograph of the tibia. */
export interface TibialPlateauAngleInput {
    /** Cranial margin of the medial tibial plateau. */
    plateauCranial: Point2D;
    /** Caudal margin of the medial tibial plateau. */
    plateauCaudal: Point2D;
    /** Centre of the intercondylar eminences (proximal point of the functional axis). */
    intercondylarEminence: Point2D;
    /** Centre of the talus (distal point of the functional axis). */
    talusCenter: Point2D;
}

/**
 * Tibial plateau angle (TPA), in degrees: the angle between the medial tibial plateau line and
 * the line perpendicular to the tibial functional axis (Slocum & Slocum, 1993).
 *
 * Positive when the plateau slopes caudodistally (the usual case), negative when it slopes
 * cranially. Independent of image orientation and limb side.
 */
export function tibialPlateauAngle(input: TibialPlateauAngleInput): number {
    const plateau = vectorBetween(input.plateauCaudal, input.plateauCranial, 'Tibial plateau line');
    const proximalAxis = vectorBetween(input.talusCenter, input.intercondylarEminence, 'Tibial functional axis');
    return 90 - angleBetweenVectors(plateau, proximalAxis);
}

/** Landmarks on a craniocaudal (frontal-plane) radiograph of the tibia. */
export interface MedialProximalTibialAngleInput {
    /** Medial margin of the proximal tibial joint surface. */
    plateauMedial: Point2D;
    /** Lateral margin of the proximal tibial joint surface. */
    plateauLateral: Point2D;
    /** Proximal point of the tibial mechanical axis (centre of the intercondylar eminences). */
    proximalAxisPoint: Point2D;
    /** Distal point of the tibial mechanical axis (centre of the distal tibia / talus). */
    distalAxisPoint: Point2D;
}

/**
 * Mechanical medial proximal tibial angle (mMPTA), in degrees: the medial angle between the
 * proximal tibial joint orientation line and the tibial mechanical axis. 90° means the joint
 * line is perpendicular to the axis; values above 90° mean the medial side is more proximal.
 * Reference value in large-breed dogs: about 93.5° (Dismukes et al., 2007).
 */
export function mechanicalMedialProximalTibialAngle(input: MedialProximalTibialAngleInput): number {
    const jointLine = vectorBetween(input.plateauLateral, input.plateauMedial, 'Proximal tibial joint line');
    const distalAxis = vectorBetween(input.proximalAxisPoint, input.distalAxisPoint, 'Tibial mechanical axis');
    return angleBetweenVectors(jointLine, distalAxis);
}

/** Commonly targeted post-operative TPA for TPLO, in degrees. Override per surgeon protocol. */
export const DEFAULT_TPLO_TARGET_PLATEAU_ANGLE = 5;

export interface TploRotationInput {
    /** Pre-operative TPA in degrees (from `tibialPlateauAngle`). */
    tibialPlateauAngle: number;
    /** Desired post-operative TPA in degrees. Defaults to 5°. */
    targetPlateauAngle?: number;
    /** Radius of the biradial saw blade, in millimetres. */
    sawBladeRadiusMm: number;
}

export interface TploRotationPlan {
    /** Rotation of the proximal tibial segment, in degrees. */
    rotationDegrees: number;
    /** Straight-line distance between the reference marks after rotation (what calipers measure). */
    chordLengthMm: number;
    /** Distance travelled along the osteotomy arc. */
    arcLengthMm: number;
}

/**
 * Rotation needed to level the plateau, and the matching displacement along a radial osteotomy.
 *
 * Assumes the osteotomy is centred on the intercondylar eminences, so the functional axis is
 * unchanged and the TPA drops by exactly the rotation angle. An off-centre osteotomy shifts the
 * axis and changes the achieved TPA; re-measure post-operatively.
 */
export function tploRotationPlan(input: TploRotationInput): TploRotationPlan {
    const target = input.targetPlateauAngle ?? DEFAULT_TPLO_TARGET_PLATEAU_ANGLE;
    if (!Number.isFinite(input.tibialPlateauAngle) || !Number.isFinite(target)) {
        throw new RangeError('Plateau angles must be finite numbers of degrees');
    }
    if (!Number.isFinite(input.sawBladeRadiusMm) || input.sawBladeRadiusMm <= 0) {
        throw new RangeError('Saw blade radius must be a positive number of millimetres');
    }

    const rotationDegrees = input.tibialPlateauAngle - target;
    if (rotationDegrees < 0) {
        throw new RangeError(
            `The plateau angle (${input.tibialPlateauAngle}°) is already below the target (${target}°)`,
        );
    }

    const rotation = toRadians(rotationDegrees);
    return {
        rotationDegrees,
        chordLengthMm: 2 * input.sawBladeRadiusMm * Math.sin(rotation / 2),
        arcLengthMm: input.sawBladeRadiusMm * rotation,
    };
}
