import { z } from 'zod';
import { PatientSex } from '../enums/patient-sex.enum.js';
import { Species } from '../enums/species.enum.js';
import { optionalDate, optionalText, paginationQuerySchema } from './common.dto.js';

export const createPatientSchema = z.object({
    name: z.string().trim().min(1, { error: 'Required' }).max(120, { error: 'At most 120 characters' }),
    species: z.enum(Species, { error: 'Choose a species' }),
    breed: optionalText(120),
    sex: z.enum(PatientSex).nullish(),
    dateOfBirth: optionalDate(),
    weightKg: z.number({ error: 'Enter the weight in kg' }).positive({ error: 'Enter the weight in kg' }).max(200, { error: 'At most 200 kg' }).nullish(),
    ownerName: optionalText(160),
    /** The clinic's own record number. */
    externalId: optionalText(64),
});
export type CreatePatientDto = z.infer<typeof createPatientSchema>;

export const updatePatientSchema = createPatientSchema.partial();
export type UpdatePatientDto = z.infer<typeof updatePatientSchema>;

export const patientQuerySchema = paginationQuerySchema.extend({
    search: z.string().trim().max(120).optional(),
    species: z.enum(Species).optional(),
});
export type PatientQueryDto = z.infer<typeof patientQuerySchema>;

export interface PatientDto {
    id: string;
    name: string;
    species: Species;
    breed: string | null;
    sex: PatientSex | null;
    dateOfBirth: string | null;
    weightKg: number | null;
    ownerName: string | null;
    externalId: string | null;
    createdAt: string;
    updatedAt: string;
}

export type PatientSummaryDto = Pick<PatientDto, 'id' | 'name' | 'species' | 'breed' | 'ownerName' | 'externalId'>;
