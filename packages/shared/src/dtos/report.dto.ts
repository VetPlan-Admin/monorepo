import type { CaseStatus } from '../enums/case-status.enum.js';
import type { Limb } from '../enums/limb.enum.js';
import type { ProcedureType } from '../enums/procedure-type.enum.js';
import type { MeasurementType, MeasurementValue } from '../measurements/types.js';
import type { Point2D } from '../math/geometry.js';
import type { PatientDto } from './patients.dto.js';

export const SURGICAL_PLAN_REPORT_FORMAT = 'vet-plan.surgical-plan-report';
export const SURGICAL_PLAN_REPORT_VERSION = 1;

/** Machine-readable surgical planning report (`GET /cases/:id/report`). */
export interface SurgicalPlanReportDto {
    format: typeof SURGICAL_PLAN_REPORT_FORMAT;
    version: typeof SURGICAL_PLAN_REPORT_VERSION;
    generatedAt: string;
    generatedBy: { id: string; displayName: string };
    clinic: { id: string; name: string };
    patient: PatientDto;
    case: {
        id: string;
        procedureType: ProcedureType;
        limb: Limb | null;
        status: CaseStatus;
        surgeryDate: string | null;
        notes: string | null;
        createdAt: string;
        updatedAt: string;
    };
    plans: {
        id: string;
        label: string;
        image: { width: number; height: number };
        calibration: { mmPerPixel: number; source: string } | null;
        measurements: {
            id: string;
            type: MeasurementType;
            name: string;
            status: 'complete' | 'incomplete' | 'invalid';
            values: (MeasurementValue & { formatted: string })[];
            warnings: string[];
            message?: string;
            landmarks: Record<string, Point2D[]>;
            parameters: Record<string, number>;
        }[];
        savedAt: string;
    }[];
    disclaimer: string;
}
