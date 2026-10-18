import { formatMeasurementValue, getMeasurementDefinition, SURGICAL_PLAN_REPORT_FORMAT, SURGICAL_PLAN_REPORT_VERSION } from '@vet-plan/shared';
import type { SurgicalPlanReportDto } from '@vet-plan/shared';
import { toPatientDto } from '../patients/patient.mapper.js';
import type { Tenant } from '../tenants/tenant.entity.js';
import type { User } from '../users/user.entity.js';
import type { RadiographPlan } from './radiograph-plan.entity.js';
import type { SurgicalCase } from './surgical-case.entity.js';

export const REPORT_DISCLAIMER =
    'Decision support only. Values were computed by Vet Plan from landmarks placed by the clinician; ' +
    'landmark placement, radiographic positioning and the surgical plan remain the surgeon’s responsibility.';

export function buildSurgicalPlanReport(input: {
    clinic: Tenant;
    surgicalCase: SurgicalCase;
    plans: RadiographPlan[];
    generatedBy: User;
    generatedAt: Date;
}): SurgicalPlanReportDto {
    const { clinic, surgicalCase, plans, generatedBy, generatedAt } = input;
    return {
        format: SURGICAL_PLAN_REPORT_FORMAT,
        version: SURGICAL_PLAN_REPORT_VERSION,
        generatedAt: generatedAt.toISOString(),
        generatedBy: { id: generatedBy.id, displayName: generatedBy.displayName },
        clinic: { id: clinic.id, name: clinic.name },
        patient: toPatientDto(surgicalCase.patient),
        case: {
            id: surgicalCase.id,
            procedureType: surgicalCase.procedureType,
            limb: surgicalCase.limb,
            status: surgicalCase.status,
            surgeryDate: surgicalCase.surgeryDate,
            notes: surgicalCase.notes,
            createdAt: surgicalCase.createdAt.toISOString(),
            updatedAt: surgicalCase.updatedAt.toISOString(),
        },
        plans: plans.map((plan) => ({
            id: plan.id,
            label: plan.label,
            image: { width: plan.imageWidth, height: plan.imageHeight },
            calibration: plan.calibration,
            measurements: plan.results.map((result) => {
                const measurement = plan.measurements.find((m) => m.id === result.id)!;
                return {
                    id: result.id,
                    type: result.type,
                    name: getMeasurementDefinition(result.type).name,
                    status: result.status,
                    values: result.values.map((value) => ({ ...value, formatted: formatMeasurementValue(value) })),
                    warnings: result.warnings,
                    ...(result.message ? { message: result.message } : {}),
                    landmarks: measurement.points,
                    parameters: measurement.parameters,
                };
            }),
            savedAt: plan.updatedAt.toISOString(),
        })),
        disclaimer: REPORT_DISCLAIMER,
    };
}
