export enum Species {
    CANINE = 'CANINE',
    FELINE = 'FELINE',
}

export const SPECIES_LABELS: Readonly<Record<Species, string>> = {
    [Species.CANINE]: 'Canine',
    [Species.FELINE]: 'Feline',
};
