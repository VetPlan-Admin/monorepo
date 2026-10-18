export enum Role {
    SUPER_ADMIN = 'SUPER_ADMIN',
    CLINIC_ADMIN = 'CLINIC_ADMIN',
    VETERINARIAN = 'VETERINARIAN',
    ASSISTANT = 'ASSISTANT',
}

export const ALL_ROLES: readonly Role[] = Object.values(Role);

/** Clinic staff who may read patients and cases (platform SUPER_ADMINs see no clinical data). */
export const CLINICAL_ROLES: readonly Role[] = [Role.ASSISTANT, Role.VETERINARIAN, Role.CLINIC_ADMIN];

/** Clinic staff who may create cases and surgical plans. */
export const PLANNING_ROLES: readonly Role[] = [Role.VETERINARIAN, Role.CLINIC_ADMIN];
