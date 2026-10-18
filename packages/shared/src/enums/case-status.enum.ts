/** Lifecycle of a surgical case. Plans can only change while PLANNING or PLANNED. */
export enum CaseStatus {
    PLANNING = 'PLANNING',
    PLANNED = 'PLANNED',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
}

export const CASE_STATUS_LABELS: Readonly<Record<CaseStatus, string>> = {
    [CaseStatus.PLANNING]: 'Planning',
    [CaseStatus.PLANNED]: 'Planned',
    [CaseStatus.COMPLETED]: 'Completed',
    [CaseStatus.CANCELLED]: 'Cancelled',
};

/** Allowed status changes. COMPLETED is final; CANCELLED can be reopened. */
export const CASE_STATUS_TRANSITIONS: Readonly<Record<CaseStatus, readonly CaseStatus[]>> = {
    [CaseStatus.PLANNING]: [CaseStatus.PLANNED, CaseStatus.CANCELLED],
    [CaseStatus.PLANNED]: [CaseStatus.PLANNING, CaseStatus.COMPLETED, CaseStatus.CANCELLED],
    [CaseStatus.COMPLETED]: [],
    [CaseStatus.CANCELLED]: [CaseStatus.PLANNING],
};

export function canTransitionCase(from: CaseStatus, to: CaseStatus): boolean {
    return CASE_STATUS_TRANSITIONS[from].includes(to);
}

/** Whether plans and clinical fields may still change. */
export function isCaseEditable(status: CaseStatus): boolean {
    return status === CaseStatus.PLANNING || status === CaseStatus.PLANNED;
}
