/**
 * 2D geometry primitives for radiograph measurements.
 *
 * Coordinates are image pixels in any orientation (y may point up or down, the limb may be
 * left or right): every measurement in this module is built from dot/cross products of
 * landmark vectors, so results don't depend on how the image is rotated or mirrored.
 * Angles are exposed in degrees (the clinical unit) and computed internally in radians.
 */

export interface Point2D {
    x: number;
    y: number;
}

export interface Circle {
    center: Point2D;
    radius: number;
}

const RADIANS_TO_DEGREES = 180 / Math.PI;

export function toDegrees(radians: number): number {
    return radians * RADIANS_TO_DEGREES;
}

export function toRadians(degrees: number): number {
    return degrees / RADIANS_TO_DEGREES;
}

/** Throws a RangeError naming the landmark when a coordinate is NaN or infinite. */
export function assertFinitePoint(point: Point2D, name: string): void {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        throw new RangeError(`${name} must have finite x and y coordinates`);
    }
}

export function subtract(a: Point2D, b: Point2D): Point2D {
    return { x: a.x - b.x, y: a.y - b.y };
}

export function add(a: Point2D, b: Point2D): Point2D {
    return { x: a.x + b.x, y: a.y + b.y };
}

export function scale(v: Point2D, factor: number): Point2D {
    return { x: v.x * factor, y: v.y * factor };
}

export function dot(a: Point2D, b: Point2D): number {
    return a.x * b.x + a.y * b.y;
}

/** z-component of the 3D cross product; its sign tells which side `b` lies on relative to `a`. */
export function cross(a: Point2D, b: Point2D): number {
    return a.x * b.y - a.y * b.x;
}

export function length(v: Point2D): number {
    return Math.hypot(v.x, v.y);
}

export function distance(a: Point2D, b: Point2D): number {
    return length(subtract(a, b));
}

export function midpoint(a: Point2D, b: Point2D): Point2D {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Vector from `from` to `to`, validated: both landmarks finite and not coincident.
 * `description` names the segment in error messages (e.g. "tibial plateau line").
 */
export function vectorBetween(from: Point2D, to: Point2D, description: string): Point2D {
    assertFinitePoint(from, `${description} start`);
    assertFinitePoint(to, `${description} end`);
    const v = subtract(to, from);
    if (length(v) === 0) {
        throw new RangeError(`${description}: the two landmarks must not coincide`);
    }
    return v;
}

export function normalize(v: Point2D): Point2D {
    const len = length(v);
    if (len === 0 || !Number.isFinite(len)) {
        throw new RangeError('Cannot normalize a zero-length or non-finite vector');
    }
    return { x: v.x / len, y: v.y / len };
}

/**
 * Unsigned angle between two vectors in degrees, in [0, 180].
 * Uses atan2(|a×b|, a·b), which stays accurate for nearly parallel vectors (acos does not).
 */
export function angleBetweenVectors(a: Point2D, b: Point2D): number {
    if (length(a) === 0 || length(b) === 0) {
        throw new RangeError('Cannot measure an angle with a zero-length vector');
    }
    return toDegrees(Math.atan2(Math.abs(cross(a, b)), dot(a, b)));
}

/**
 * Least-squares circle through three or more points (algebraic "Kåsa" fit). With exactly three
 * points it returns their circumscribed circle. Points are centred and scaled first, so results
 * stay stable at large pixel coordinates.
 *
 * Used for femoral head centres (Norberg angle) and calibration-marker diameters.
 */
export function fitCircle(points: readonly Point2D[]): Circle {
    if (points.length < 3) {
        throw new RangeError('A circle needs at least three points');
    }
    points.forEach((p, i) => assertFinitePoint(p, `Circle point ${i + 1}`));

    const n = points.length;
    const mean = {
        x: points.reduce((sum, p) => sum + p.x, 0) / n,
        y: points.reduce((sum, p) => sum + p.y, 0) / n,
    };
    const rms = Math.sqrt(points.reduce((sum, p) => sum + distance(p, mean) ** 2, 0) / n);
    if (rms === 0) {
        throw new RangeError('Circle points must not all coincide');
    }

    // Normalised coordinates: centred on the mean, unit RMS spread
    let suu = 0;
    let suv = 0;
    let svv = 0;
    let suuu = 0;
    let svvv = 0;
    let suvv = 0;
    let svuu = 0;
    for (const p of points) {
        const u = (p.x - mean.x) / rms;
        const v = (p.y - mean.y) / rms;
        suu += u * u;
        suv += u * v;
        svv += v * v;
        suuu += u * u * u;
        svvv += v * v * v;
        suvv += u * v * v;
        svuu += v * u * u;
    }

    // Solve for the centre (uc, vc) of the circle u² + v² - 2·uc·u - 2·vc·v + c = 0
    const det = suu * svv - suv * suv;
    if (Math.abs(det) < 1e-12 * n * n) {
        throw new RangeError('Circle points must not be collinear');
    }
    const ru = (suuu + suvv) / 2;
    const rv = (svvv + svuu) / 2;
    const uc = (ru * svv - rv * suv) / det;
    const vc = (rv * suu - ru * suv) / det;
    const radiusNormalised = Math.sqrt(uc * uc + vc * vc + (suu + svv) / n);

    return {
        center: { x: mean.x + uc * rms, y: mean.y + vc * rms },
        radius: radiusNormalised * rms,
    };
}
