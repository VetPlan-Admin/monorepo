import type { ProcedureType } from '../enums/procedure-type.enum.js';
import type { Species } from '../enums/species.enum.js';

export interface CreateCaseDto {
    patientName: string;
    species: Species;
    procedureType: ProcedureType;
    notes?: string;
}
