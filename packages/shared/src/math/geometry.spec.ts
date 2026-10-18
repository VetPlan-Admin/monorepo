import { describe, expect, it } from 'vitest';
import {
    add,
    angleBetweenVectors,
    assertFinitePoint,
    cross,
    distance,
    dot,
    fitCircle,
    length,
    midpoint,
    normalize,
    scale,
    subtract,
    toDegrees,
    toRadians,
    vectorBetween,
} from './geometry.js';
import { polar } from './__fixtures__/transforms.js';

describe('vector operations', () => {
    it('adds, subtracts, scales and measures', () => {
        expect(add({ x: 1, y: 2 }, { x: 3, y: 4 })).toEqual({ x: 4, y: 6 });
        expect(subtract({ x: 1, y: 2 }, { x: 3, y: 5 })).toEqual({ x: -2, y: -3 });
        expect(scale({ x: 1, y: -2 }, 3)).toEqual({ x: 3, y: -6 });
        expect(dot({ x: 1, y: 2 }, { x: 3, y: 4 })).toBe(11);
        expect(cross({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(1);
        expect(length({ x: 3, y: 4 })).toBe(5);
        expect(distance({ x: 1, y: 1 }, { x: 4, y: 5 })).toBe(5);
        expect(midpoint({ x: 0, y: 0 }, { x: 4, y: -2 })).toEqual({ x: 2, y: -1 });
    });

    it('converts between degrees and radians', () => {
        expect(toDegrees(Math.PI)).toBeCloseTo(180, 12);
        expect(toRadians(90)).toBeCloseTo(Math.PI / 2, 12);
    });

    it('normalizes vectors and rejects zero or non-finite ones', () => {
        expect(normalize({ x: 0, y: -7 })).toEqual({ x: 0, y: -1 });
        expect(() => normalize({ x: 0, y: 0 })).toThrow(RangeError);
        expect(() => normalize({ x: Infinity, y: 0 })).toThrow(RangeError);
    });

    it('validates landmarks', () => {
        expect(() => assertFinitePoint({ x: NaN, y: 0 }, 'Talus')).toThrow('Talus must have finite x and y coordinates');
        expect(() => assertFinitePoint({ x: 0, y: -Infinity }, 'Talus')).toThrow(RangeError);
        expect(vectorBetween({ x: 1, y: 1 }, { x: 4, y: 5 }, 'Segment')).toEqual({ x: 3, y: 4 });
        expect(() => vectorBetween({ x: 1, y: 1 }, { x: 1, y: 1 }, 'Plateau')).toThrow('Plateau: the two landmarks must not coincide');
        expect(() => vectorBetween({ x: NaN, y: 1 }, { x: 1, y: 1 }, 'Plateau')).toThrow('Plateau start');
        expect(() => vectorBetween({ x: 0, y: 1 }, { x: 1, y: NaN }, 'Plateau')).toThrow('Plateau end');
    });
});

describe('angleBetweenVectors', () => {
    it.each([
        [{ x: 1, y: 0 }, { x: 1, y: 0 }, 0],
        [{ x: 1, y: 0 }, { x: 0, y: 5 }, 90],
        [{ x: 1, y: 0 }, { x: -2, y: 0 }, 180],
        [{ x: 1, y: 1 }, { x: 0, y: 1 }, 45],
        [{ x: 1, y: 0 }, { x: 1, y: -Math.sqrt(3) }, 60],
    ])('angle(%o, %o) = %d°', (a, b, expected) => {
        expect(angleBetweenVectors(a, b)).toBeCloseTo(expected, 10);
    });

    it('stays accurate for nearly parallel vectors', () => {
        expect(angleBetweenVectors({ x: 1, y: 0 }, { x: 1, y: 1e-9 })).toBeCloseTo(toDegrees(1e-9), 15);
    });

    it('rejects zero-length vectors', () => {
        expect(() => angleBetweenVectors({ x: 0, y: 0 }, { x: 1, y: 0 })).toThrow(RangeError);
        expect(() => angleBetweenVectors({ x: 1, y: 0 }, { x: 0, y: 0 })).toThrow(RangeError);
    });
});

describe('fitCircle', () => {
    it('returns the circumscribed circle of three points', () => {
        const circle = fitCircle([{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }]);
        expect(circle.center.x).toBeCloseTo(0, 12);
        expect(circle.center.y).toBeCloseTo(0, 12);
        expect(circle.radius).toBeCloseTo(1, 12);
    });

    it('recovers a femoral-head-sized circle at large pixel coordinates from a partial arc', () => {
        const center = { x: 18_500.25, y: 22_100.75 };
        const points = [200, 230, 260, 290, 320].map((deg) => polar(center, deg, 142.5));
        const circle = fitCircle(points);
        expect(circle.center.x).toBeCloseTo(center.x, 6);
        expect(circle.center.y).toBeCloseTo(center.y, 6);
        expect(circle.radius).toBeCloseTo(142.5, 6);
    });

    it('averages noisy clicks', () => {
        const center = { x: 300, y: 400 };
        const noise = [0.6, -0.4, 0.3, -0.7, 0.5, -0.2, 0.1, -0.5];
        const points = noise.map((n, i) => polar(center, i * 45, 100 + n));
        const circle = fitCircle(points);
        expect(Math.abs(circle.center.x - center.x)).toBeLessThan(0.5);
        expect(Math.abs(circle.center.y - center.y)).toBeLessThan(0.5);
        expect(Math.abs(circle.radius - 100)).toBeLessThan(0.5);
    });

    it('rejects too few, coincident, collinear or non-finite points', () => {
        expect(() => fitCircle([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toThrow('at least three points');
        expect(() => fitCircle([{ x: 2, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 2 }])).toThrow('must not all coincide');
        expect(() => fitCircle([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 5, y: 5 }])).toThrow('must not be collinear');
        expect(() => fitCircle([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: NaN, y: 5 }])).toThrow('Circle point 3');
    });
});
