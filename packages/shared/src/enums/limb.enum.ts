export enum Limb {
    LEFT = 'LEFT',
    RIGHT = 'RIGHT',
    BILATERAL = 'BILATERAL',
}

export const LIMB_LABELS: Readonly<Record<Limb, string>> = {
    [Limb.LEFT]: 'Left',
    [Limb.RIGHT]: 'Right',
    [Limb.BILATERAL]: 'Bilateral',
};
