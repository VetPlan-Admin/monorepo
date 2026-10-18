import type { Calibration } from '../math/calibration.js';
import { fitCircle } from '../math/geometry.js';
import { MEASUREMENT_DEFINITIONS } from './definitions.js';
import type {
    LandmarkDefinition,
    LandmarkPoints,
    MeasurementDefinition,
    MeasurementEvaluation,
    MeasurementType,
    OverlayShape,
    ParameterValues,
} from './types.js';

export function getMeasurementDefinition(type: MeasurementType): MeasurementDefinition {
    const definition = MEASUREMENT_DEFINITIONS[type];
    if (!definition) {
        throw new RangeError(`Unknown measurement type "${type}"`);
    }
    return definition;
}

export function defaultParameters(definition: MeasurementDefinition): Record<string, number> {
    return Object.fromEntries(definition.parameters.map((p) => [p.key, p.defaultValue]));
}

/** Defaults merged with overrides; throws RangeError for values outside each parameter's range. */
export function resolveParameters(definition: MeasurementDefinition, overrides: ParameterValues = {}): ParameterValues {
    const resolved = defaultParameters(definition);
    for (const parameter of definition.parameters) {
        const value = overrides[parameter.key] ?? parameter.defaultValue;
        if (!Number.isFinite(value) || value < parameter.min || value > parameter.max) {
            throw new RangeError(`${parameter.label} must be between ${parameter.min} and ${parameter.max} ${parameter.unit}`);
        }
        resolved[parameter.key] = value;
    }
    return resolved;
}

/** The landmark (and point within it) to place next, or undefined when all are placed. */
export function nextLandmarkSlot(
    definition: MeasurementDefinition,
    points: LandmarkPoints,
): { landmark: LandmarkDefinition; pointIndex: number } | undefined {
    for (const landmark of definition.landmarks) {
        const placed = points[landmark.key]?.length ?? 0;
        if (placed < landmark.pointCount) {
            return { landmark, pointIndex: placed };
        }
    }
    return undefined;
}

/** Construction lines and fitted outlines for whatever has been placed so far. */
function constructionOverlay(definition: MeasurementDefinition, points: LandmarkPoints): OverlayShape[] {
    const overlay: OverlayShape[] = [];
    for (const segment of definition.segments) {
        const from = points[segment.from]?.[0];
        const to = points[segment.to]?.[0];
        if (from && to) {
            overlay.push({ kind: 'segment', from, to, emphasis: segment.emphasis });
        }
    }
    for (const landmark of definition.landmarks) {
        const outline = points[landmark.key];
        if (landmark.pointCount === 3 && outline && outline.length >= 3) {
            try {
                const { center, radius } = fitCircle(outline.slice(0, 3));
                overlay.push({ kind: 'circle', center, radius, emphasis: 'secondary' });
            } catch {
                // Collinear clicks: nothing to draw yet; full evaluation reports the error
            }
        }
    }
    return overlay;
}

/** Evaluates a measurement with an explicit definition (used by `evaluateMeasurement` and tests). */
export function evaluateMeasurementWith(
    definition: MeasurementDefinition,
    points: LandmarkPoints,
    parameters?: ParameterValues,
    calibration?: Calibration,
): MeasurementEvaluation {
    const overlay = constructionOverlay(definition, points);
    const slot = nextLandmarkSlot(definition, points);
    if (slot) {
        return { status: 'incomplete', nextLandmark: slot.landmark, nextPointIndex: slot.pointIndex, overlay };
    }

    const completePoints = Object.fromEntries(
        definition.landmarks.map((landmark) => [landmark.key, points[landmark.key]!.slice(0, landmark.pointCount)]),
    );
    try {
        const output = definition.compute({
            points: completePoints,
            parameters: resolveParameters(definition, parameters),
            calibration,
        });
        return { status: 'complete', ...output, overlay: [...overlay, ...output.overlay] };
    } catch (error) {
        if (!(error instanceof RangeError)) {
            throw error;
        }
        return { status: 'invalid', message: error.message, overlay };
    }
}

/**
 * Evaluates a measurement from its placed landmarks. Never throws for clinical input: invalid
 * geometry or parameters come back as `{ status: 'invalid', message }` for the UI to show.
 */
export function evaluateMeasurement(
    type: MeasurementType,
    points: LandmarkPoints,
    parameters?: ParameterValues,
    calibration?: Calibration,
): MeasurementEvaluation {
    return evaluateMeasurementWith(getMeasurementDefinition(type), points, parameters, calibration);
}
