export enum Role {
    SUPER_ADMIN = 'SUPER_ADMIN',
    CLINIC_ADMIN = 'CLINIC_ADMIN',
    VETERINARIAN = 'VETERINARIAN',
    ASSISTANT = 'ASSISTANT',
}

export const ALL_ROLES: readonly Role[] = Object.values(Role);
