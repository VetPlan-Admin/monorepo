export enum PatientSex {
    MALE = 'MALE',
    MALE_NEUTERED = 'MALE_NEUTERED',
    FEMALE = 'FEMALE',
    FEMALE_SPAYED = 'FEMALE_SPAYED',
}

export const PATIENT_SEX_LABELS: Readonly<Record<PatientSex, string>> = {
    [PatientSex.MALE]: 'Male',
    [PatientSex.MALE_NEUTERED]: 'Male (neutered)',
    [PatientSex.FEMALE]: 'Female',
    [PatientSex.FEMALE_SPAYED]: 'Female (spayed)',
};
