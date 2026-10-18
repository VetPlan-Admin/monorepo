import { z } from 'zod';
import type { MeasurementResult, PlanMeasurement } from '../measurements/plan.js';
import { MeasurementType } from '../measurements/types.js';

const pointSchema = z.object({ x: z.number(), y: z.number() });

export const planMeasurementSchema = z.object({
    id: z.string().min(1).max(64),
    type: z.enum(MeasurementType),
    points: z.record(z.string().min(1).max(64), z.array(pointSchema).max(3)),
    parameters: z.record(z.string().min(1).max(64), z.number()),
});

export const imageSpacingSchema = z.object({
    mmPerPixel: z.number().positive().max(10),
    source: z.enum(['PixelSpacing', 'ImagerPixelSpacing']),
});

const MAX_IMAGE_SIDE = 100_000;

export const savePlanSchema = z
    .object({
        label: z.string().trim().min(1).max(120),
        imageWidth: z.number().int().positive().max(MAX_IMAGE_SIDE),
        imageHeight: z.number().int().positive().max(MAX_IMAGE_SIDE),
        imageSpacing: imageSpacingSchema.nullish(),
        measurements: z.array(planMeasurementSchema).max(50),
    })
    .superRefine((plan, context) => {
        plan.measurements.forEach((measurement, m) => {
            for (const [key, points] of Object.entries(measurement.points)) {
                if (points.some((p) => p.x < 0 || p.y < 0 || p.x > plan.imageWidth || p.y > plan.imageHeight)) {
                    context.addIssue({
                        code: 'custom',
                        path: ['measurements', m, 'points', key],
                        message: 'Landmarks must lie inside the image',
                    });
                }
            }
        });
    });
export type SavePlanDto = z.infer<typeof savePlanSchema>;

export interface RadiographPlanDto {
    id: string;
    caseId: string;
    label: string;
    imageWidth: number;
    imageHeight: number;
    imageSpacing: z.infer<typeof imageSpacingSchema> | null;
    /** Scale the server used for millimetre results. */
    calibration: { mmPerPixel: number; source: string } | null;
    measurements: PlanMeasurement[];
    /** Computed by the server when the plan was saved (never by the client). */
    results: MeasurementResult[];
    createdBy: { id: string; displayName: string } | null;
    createdAt: string;
    updatedAt: string;
}
