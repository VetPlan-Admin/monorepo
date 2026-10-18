import { z } from 'zod';
import { CaseStatus } from '../enums/case-status.enum.js';
import { Limb } from '../enums/limb.enum.js';
import { ProcedureType } from '../enums/procedure-type.enum.js';
import { optionalDate, optionalText, paginationQuerySchema } from './common.dto.js';
import type { PatientDto, PatientSummaryDto } from './patients.dto.js';
import type { RadiographPlanDto } from './plans.dto.js';

export const createCaseSchema = z.object({
    patientId: z.uuid({ error: 'Choose a patient' }),
    procedureType: z.enum(ProcedureType, { error: 'Choose a procedure' }),
    limb: z.enum(Limb).nullish(),
    surgeryDate: optionalDate(),
    notes: optionalText(5000),
});
export type CreateCaseDto = z.infer<typeof createCaseSchema>;

export const updateCaseSchema = z
    .object({
        procedureType: z.enum(ProcedureType),
        limb: z.enum(Limb).nullable(),
        surgeryDate: z.iso.date().nullable(),
        notes: z.string().trim().max(5000).nullable(),
        status: z.enum(CaseStatus),
    })
    .partial()
    .refine((update) => Object.keys(update).length > 0, { message: 'Nothing to update' });
export type UpdateCaseDto = z.infer<typeof updateCaseSchema>;

export const caseQuerySchema = paginationQuerySchema.extend({
    /** Matches patient name, owner name or the clinic's record number. */
    search: z.string().trim().max(120).optional(),
    status: z.enum(CaseStatus).optional(),
    procedureType: z.enum(ProcedureType).optional(),
    patientId: z.uuid().optional(),
});
export type CaseQueryDto = z.infer<typeof caseQuerySchema>;

export interface CaseSummaryDto {
    id: string;
    patient: PatientSummaryDto;
    procedureType: ProcedureType;
    limb: Limb | null;
    status: CaseStatus;
    surgeryDate: string | null;
    planCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface CaseDetailDto extends Omit<CaseSummaryDto, 'patient'> {
    patient: PatientDto;
    notes: string | null;
    createdBy: { id: string; displayName: string } | null;
    plans: RadiographPlanDto[];
    /** Status changes the API accepts from the current status. */
    allowedTransitions: CaseStatus[];
}
