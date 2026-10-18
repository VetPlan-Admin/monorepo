export enum ProcedureType {
    TPLO = 'TPLO', // Tibial Plateau Leveling Osteotomy
    TTA = 'TTA', // Tibial Tuberosity Advancement
    HIP_ASSESSMENT = 'HIP_ASSESSMENT', // Hip dysplasia evaluation (Norberg angle)
    OTHER = 'OTHER',
}

export const PROCEDURE_TYPE_LABELS: Readonly<Record<ProcedureType, string>> = {
    [ProcedureType.TPLO]: 'TPLO',
    [ProcedureType.TTA]: 'TTA',
    [ProcedureType.HIP_ASSESSMENT]: 'Hip assessment',
    [ProcedureType.OTHER]: 'Other',
};
