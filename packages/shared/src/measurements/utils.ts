import type { Point2D } from '../math/geometry.js';
import type { MeasurementContext } from './types.js';

/** First point of a single-point landmark (callers only run on complete landmark sets). */
export function landmark(context: MeasurementContext, key: string): Point2D {
    return context.points[key]![0]!;
}

/** All points of a landmark (outlines). */
export function landmarkPoints(context: MeasurementContext, key: string): readonly Point2D[] {
    return context.points[key]!;
}

/**
 * Runs an optional step of a measurement: a RangeError becomes a warning instead of invalidating
 * the whole measurement (e.g. "no TTA cage is large enough"). Other errors are bugs and propagate.
 */
export function tryOrWarn(step: () => void, warnings: string[]): void {
    try {
        step();
    } catch (error) {
        if (!(error instanceof RangeError)) {
            throw error;
        }
        warnings.push(error.message);
    }
}
