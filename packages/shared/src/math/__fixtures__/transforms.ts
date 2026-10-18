// Test-only helpers, imported by the specs (excluded from coverage and from the build)
import type { Point2D } from '../geometry.js';

/** Point at `distance` from `origin` in direction `degrees` (counter-clockwise from +x). */
export function polar(origin: Point2D, degrees: number, distance: number): Point2D {
    const r = (degrees * Math.PI) / 180;
    return { x: origin.x + distance * Math.cos(r), y: origin.y + distance * Math.sin(r) };
}

export interface ImageTransform {
    rotateDegrees: number;
    scale: number;
    translate: Point2D;
    mirror: boolean;
}

/** A spread of rigid + similarity transforms, including mirrored (other-limb) images and y-down screens. */
export const IMAGE_TRANSFORMS: ImageTransform[] = [
    { rotateDegrees: 0, scale: 1, translate: { x: 0, y: 0 }, mirror: false },
    { rotateDegrees: 37, scale: 1, translate: { x: 1200, y: -340 }, mirror: false },
    { rotateDegrees: 180, scale: 2.5, translate: { x: -50, y: 75 }, mirror: false },
    { rotateDegrees: -90, scale: 0.4, translate: { x: 3000, y: 4000 }, mirror: true },
    { rotateDegrees: 211, scale: 7, translate: { x: 1e5, y: 1e5 }, mirror: true },
];

export function transformPoint(p: Point2D, t: ImageTransform): Point2D {
    const x = t.mirror ? -p.x : p.x;
    const r = (t.rotateDegrees * Math.PI) / 180;
    return {
        x: t.scale * (x * Math.cos(r) - p.y * Math.sin(r)) + t.translate.x,
        y: t.scale * (x * Math.sin(r) + p.y * Math.cos(r)) + t.translate.y,
    };
}

/** Applies the transform to every Point2D-valued property of a landmark object. */
export function transformLandmarks<T extends Record<string, Point2D>>(landmarks: T, t: ImageTransform): T {
    return Object.fromEntries(
        Object.entries(landmarks).map(([key, p]) => [key, transformPoint(p, t)]),
    ) as T;
}
