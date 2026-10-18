import type { Calibration } from '../math/calibration.js';
import type { Point2D } from '../math/geometry.js';
import { evaluateMeasurement, getMeasurementDefinition } from './evaluate.js';
import { MeasurementType } from './types.js';
import type { MeasurementEvaluation, MeasurementValue } from './types.js';

/** One measurement of a plan as stored and transmitted: landmarks only, never computed values. */
export interface PlanMeasurement {
    id: string;
    type: MeasurementType;
    points: Record<string, Point2D[]>;
    parameters: Record<string, number>;
}

/** Scale declared by the image file (DICOM PixelSpacing / ImagerPixelSpacing). */
export interface ImageSpacing {
    mmPerPixel: number;
    source: 'PixelSpacing' | 'ImagerPixelSpacing';
}

export interface PlanCalibration {
    calibration?: Calibration;
    /** Human-readable origin, e.g. "Calibration (marker ball)" or "DICOM PixelSpacing". */
    source?: string;
}

const CALIBRATION_TYPES = new Set<MeasurementType>([MeasurementType.CALIBRATION_MARKER, MeasurementType.CALIBRATION_LENGTH]);

/**
 * Scale for millimetre results: the most recently added complete calibration measurement wins,
 * then the image's declared spacing, otherwise none (angles only).
 */
export function resolvePlanCalibration(
    measurements: readonly PlanMeasurement[],
    spacing?: ImageSpacing | null,
): PlanCalibration {
    for (const measurement of [...measurements].reverse()) {
        if (!CALIBRATION_TYPES.has(measurement.type)) {
            continue;
        }
        const evaluation = evaluateMeasurement(measurement.type, measurement.points, measurement.parameters);
        if (evaluation.status === 'complete' && evaluation.calibration) {
            return { calibration: evaluation.calibration, source: getMeasurementDefinition(measurement.type).name };
        }
    }
    return spacing ? { calibration: { mmPerPixel: spacing.mmPerPixel }, source: `DICOM ${spacing.source}` } : {};
}

export function evaluatePlanMeasurements<T extends PlanMeasurement>(
    measurements: readonly T[],
    calibration: Calibration | undefined,
): { measurement: T; evaluation: MeasurementEvaluation }[] {
    return measurements.map((measurement) => ({
        measurement,
        evaluation: evaluateMeasurement(measurement.type, measurement.points, measurement.parameters, calibration),
    }));
}

/** Serializable outcome of one measurement (no overlay geometry). */
export interface MeasurementResult {
    id: string;
    type: MeasurementType;
    status: MeasurementEvaluation['status'];
    values: MeasurementValue[];
    warnings: string[];
    /** Set for `invalid` measurements; for `incomplete` ones, the next landmark to place. */
    message?: string;
}

export function summarizeEvaluation(measurement: PlanMeasurement, evaluation: MeasurementEvaluation): MeasurementResult {
    const base = { id: measurement.id, type: measurement.type, status: evaluation.status };
    switch (evaluation.status) {
        case 'complete':
            return { ...base, values: evaluation.values, warnings: evaluation.warnings };
        case 'invalid':
            return { ...base, values: [], warnings: [], message: evaluation.message };
        case 'incomplete':
            return { ...base, values: [], warnings: [], message: `Missing landmark: ${evaluation.nextLandmark.label}` };
    }
}

/** Server-side evaluation of a saved plan: calibration, then every measurement. */
export function computePlanResults(
    measurements: readonly PlanMeasurement[],
    spacing?: ImageSpacing | null,
): { calibration: (Calibration & { source: string }) | null; results: MeasurementResult[] } {
    const { calibration, source } = resolvePlanCalibration(measurements, spacing);
    return {
        calibration: calibration ? { mmPerPixel: calibration.mmPerPixel, source: source! } : null,
        results: evaluatePlanMeasurements(measurements, calibration).map(({ measurement, evaluation }) =>
            summarizeEvaluation(measurement, evaluation),
        ),
    };
}
