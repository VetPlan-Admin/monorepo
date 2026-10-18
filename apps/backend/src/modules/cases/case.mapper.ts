import { CASE_STATUS_TRANSITIONS } from '@vet-plan/shared';
import type { CaseDetailDto, CaseSummaryDto, RadiographPlanDto } from '@vet-plan/shared';
import type { User } from '../users/user.entity.js';
import { toPatientDto, toPatientSummaryDto } from '../patients/patient.mapper.js';
import type { RadiographPlan } from './radiograph-plan.entity.js';
import type { SurgicalCase } from './surgical-case.entity.js';

function author(user: User | null | undefined): { id: string; displayName: string } | null {
    return user ? { id: user.id, displayName: user.displayName } : null;
}

export function toPlanDto(plan: RadiographPlan): RadiographPlanDto {
    return {
        id: plan.id,
        caseId: plan.caseId,
        label: plan.label,
        imageWidth: plan.imageWidth,
        imageHeight: plan.imageHeight,
        imageSpacing: plan.imageSpacing,
        calibration: plan.calibration,
        measurements: plan.measurements,
        results: plan.results,
        createdBy: author(plan.createdBy),
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
    };
}

export function toCaseSummaryDto(surgicalCase: SurgicalCase, planCount: number): CaseSummaryDto {
    return {
        id: surgicalCase.id,
        patient: toPatientSummaryDto(surgicalCase.patient),
        procedureType: surgicalCase.procedureType,
        limb: surgicalCase.limb,
        status: surgicalCase.status,
        surgeryDate: surgicalCase.surgeryDate,
        planCount,
        createdAt: surgicalCase.createdAt.toISOString(),
        updatedAt: surgicalCase.updatedAt.toISOString(),
    };
}

export function toCaseDetailDto(surgicalCase: SurgicalCase, plans: RadiographPlan[]): CaseDetailDto {
    return {
        ...toCaseSummaryDto(surgicalCase, plans.length),
        patient: toPatientDto(surgicalCase.patient),
        notes: surgicalCase.notes,
        createdBy: author(surgicalCase.createdBy),
        plans: plans.map(toPlanDto),
        allowedTransitions: [...CASE_STATUS_TRANSITIONS[surgicalCase.status]],
    };
}
