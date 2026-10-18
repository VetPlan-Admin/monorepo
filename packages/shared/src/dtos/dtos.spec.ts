import { describe, expect, it } from 'vitest';
import { CaseStatus, canTransitionCase, isCaseEditable } from '../enums/case-status.enum.js';
import { CLINICAL_ROLES, PLANNING_ROLES, Role } from '../enums/roles.enum.js';
import { Species } from '../enums/species.enum.js';
import { MeasurementType } from '../measurements/types.js';
import { caseQuerySchema, createCaseSchema, updateCaseSchema } from './cases.dto.js';
import { createPatientSchema, patientQuerySchema } from './patients.dto.js';
import { savePlanSchema } from './plans.dto.js';

describe('case status rules', () => {
    it('allows only the documented transitions', () => {
        expect(canTransitionCase(CaseStatus.PLANNING, CaseStatus.PLANNED)).toBe(true);
        expect(canTransitionCase(CaseStatus.PLANNED, CaseStatus.COMPLETED)).toBe(true);
        expect(canTransitionCase(CaseStatus.CANCELLED, CaseStatus.PLANNING)).toBe(true);
        expect(canTransitionCase(CaseStatus.PLANNING, CaseStatus.COMPLETED)).toBe(false);
        expect(canTransitionCase(CaseStatus.COMPLETED, CaseStatus.PLANNING)).toBe(false);
        expect([CaseStatus.PLANNING, CaseStatus.PLANNED].every(isCaseEditable)).toBe(true);
        expect([CaseStatus.COMPLETED, CaseStatus.CANCELLED].some(isCaseEditable)).toBe(false);
    });

    it('keeps SUPER_ADMIN out of clinical data and assistants out of planning', () => {
        expect(CLINICAL_ROLES).not.toContain(Role.SUPER_ADMIN);
        expect(PLANNING_ROLES).toEqual([Role.VETERINARIAN, Role.CLINIC_ADMIN]);
    });
});

describe('patient schemas', () => {
    it('trims, validates and allows clearing optional fields with null', () => {
        expect(createPatientSchema.parse({ name: '  Rex ', species: Species.CANINE, breed: null, weightKg: 32.5 })).toEqual({
            name: 'Rex',
            species: 'CANINE',
            breed: null,
            weightKg: 32.5,
        });
        expect(createPatientSchema.safeParse({ name: '', species: 'DRAGON' }).success).toBe(false);
        expect(createPatientSchema.safeParse({ name: 'Rex', species: 'CANINE', dateOfBirth: '2020-13-40' }).success).toBe(false);
        expect(createPatientSchema.safeParse({ name: 'Rex', species: 'CANINE', breed: '   ' }).success).toBe(false);
    });

    it('coerces pagination from query strings with defaults and limits', () => {
        expect(patientQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
        expect(patientQuerySchema.parse({ page: '3', pageSize: '50', search: ' rex ' })).toEqual({ page: 3, pageSize: 50, search: 'rex' });
        expect(patientQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false);
    });
});

describe('case schemas', () => {
    it('requires a patient UUID and a known procedure', () => {
        expect(createCaseSchema.safeParse({ patientId: 'nope', procedureType: 'TPLO' }).success).toBe(false);
        expect(createCaseSchema.parse({ patientId: '6f1c2b84-1f5e-4c2a-9d3e-2b7a1c9e0f11', procedureType: 'TPLO', limb: 'LEFT' })).toMatchObject({ limb: 'LEFT' });
        expect(caseQuerySchema.parse({ status: 'PLANNED' })).toMatchObject({ status: 'PLANNED', page: 1 });
    });

    it('rejects empty updates', () => {
        expect(updateCaseSchema.safeParse({}).success).toBe(false);
        expect(updateCaseSchema.parse({ notes: null })).toEqual({ notes: null });
    });
});

describe('plan schema', () => {
    const plan = (x: number) => ({
        label: 'Left stifle ML',
        imageWidth: 800,
        imageHeight: 600,
        measurements: [{ id: 'd', type: MeasurementType.DISTANCE, points: { start: [{ x, y: 10 }] }, parameters: {} }],
    });

    it('accepts landmarks inside the image and rejects ones outside it', () => {
        expect(savePlanSchema.safeParse(plan(400)).success).toBe(true);
        const outside = savePlanSchema.safeParse(plan(900));
        expect(outside.success).toBe(false);
        expect(outside.error?.issues[0]).toMatchObject({ path: ['measurements', 0, 'points', 'start'], message: 'Landmarks must lie inside the image' });
    });

    it('rejects non-finite coordinates and unknown measurement types', () => {
        expect(savePlanSchema.safeParse({ ...plan(1), measurements: [{ ...plan(1).measurements[0], points: { start: [{ x: Infinity, y: 1 }] } }] }).success).toBe(false);
        expect(savePlanSchema.safeParse({ ...plan(1), measurements: [{ ...plan(1).measurements[0], type: 'MAGIC' }] }).success).toBe(false);
    });
});
