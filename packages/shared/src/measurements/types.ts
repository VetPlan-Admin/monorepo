import type { Calibration } from '../math/calibration.js';
import type { Point2D } from '../math/geometry.js';

/**
 * Measurement protocols: which landmarks a clinician places, which parameters apply, and how
 * the surgical math turns them into values and overlay shapes. Pure data + functions, so the
 * web canvas, a future mobile viewer, and the backend (recomputing saved measurements) agree.
 */
export enum MeasurementType {
    TIBIAL_PLATEAU_ANGLE = 'TIBIAL_PLATEAU_ANGLE',
    MEDIAL_PROXIMAL_TIBIAL_ANGLE = 'MEDIAL_PROXIMAL_TIBIAL_ANGLE',
    TTA_ADVANCEMENT = 'TTA_ADVANCEMENT',
    NORBERG_ANGLE = 'NORBERG_ANGLE',
    CALIBRATION_MARKER = 'CALIBRATION_MARKER',
    CALIBRATION_LENGTH = 'CALIBRATION_LENGTH',
    DISTANCE = 'DISTANCE',
    ANGLE_BETWEEN_LINES = 'ANGLE_BETWEEN_LINES',
}

export interface LandmarkDefinition {
    key: string;
    /** Short name shown next to the point, e.g. "Talus". */
    label: string;
    /** Prompt shown while the landmark is being placed. */
    instruction: string;
    /** 1 = a single point; 3 = points on a circular outline, fitted to a circle. */
    pointCount: 1 | 3;
}

export interface ParameterDefinition {
    key: string;
    label: string;
    unit: string;
    defaultValue: number;
    min: number;
    max: number;
    step: number;
}

/** Placed points per landmark key, in image pixels. Arrays may be partially filled. */
export type LandmarkPoints = Readonly<Record<string, readonly Point2D[]>>;
export type ParameterValues = Readonly<Record<string, number>>;

export type MeasurementUnit = '°' | 'mm' | 'mm/px' | 'px';

export interface MeasurementValue {
    key: string;
    label: string;
    value: number;
    unit: MeasurementUnit;
    decimals: number;
    assessment?: 'within-limits' | 'outside-limits';
}

export type OverlayEmphasis = 'primary' | 'secondary' | 'guide';

export type OverlayShape =
    | { kind: 'segment'; from: Point2D; to: Point2D; emphasis: OverlayEmphasis }
    | { kind: 'arrow'; from: Point2D; to: Point2D; emphasis: OverlayEmphasis }
    | { kind: 'circle'; center: Point2D; radius: number; emphasis: OverlayEmphasis }
    | { kind: 'label'; at: Point2D; text: string };

export interface MeasurementContext {
    /** All landmarks, completely placed. */
    points: Readonly<Record<string, readonly Point2D[]>>;
    parameters: ParameterValues;
    calibration?: Calibration;
}

export interface MeasurementOutput {
    values: MeasurementValue[];
    overlay: OverlayShape[];
    warnings: string[];
    /** Set by calibration measurements. */
    calibration?: Calibration;
}

export interface MeasurementDefinition {
    type: MeasurementType;
    name: string;
    /** Radiographic view the landmarks belong to. */
    view: string;
    landmarks: readonly LandmarkDefinition[];
    parameters: readonly ParameterDefinition[];
    /** Construction lines drawn as soon as both single-point landmarks exist. */
    segments: readonly { from: string; to: string; emphasis: OverlayEmphasis }[];
    /** Throws RangeError for geometrically invalid landmarks. */
    compute(context: MeasurementContext): MeasurementOutput;
}

export type MeasurementEvaluation =
    | {
          status: 'incomplete';
          nextLandmark: LandmarkDefinition;
          /** Index within `nextLandmark` (0–2 for outlines). */
          nextPointIndex: number;
          overlay: OverlayShape[];
      }
    | ({ status: 'complete' } & MeasurementOutput)
    | { status: 'invalid'; message: string; overlay: OverlayShape[] };
