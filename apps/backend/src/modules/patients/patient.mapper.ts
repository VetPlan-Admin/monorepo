import type { PatientDto, PatientSummaryDto } from '@vet-plan/shared';
import type { Patient } from './patient.entity.js';

export function toPatientDto(patient: Patient): PatientDto {
    return {
        id: patient.id,
        name: patient.name,
        species: patient.species,
        breed: patient.breed,
        sex: patient.sex,
        dateOfBirth: patient.dateOfBirth,
        weightKg: patient.weightKg,
        ownerName: patient.ownerName,
        externalId: patient.externalId,
        createdAt: patient.createdAt.toISOString(),
        updatedAt: patient.updatedAt.toISOString(),
    };
}

export function toPatientSummaryDto(patient: Patient): PatientSummaryDto {
    const { id, name, species, breed, ownerName, externalId } = patient;
    return { id, name, species, breed, ownerName, externalId };
}
