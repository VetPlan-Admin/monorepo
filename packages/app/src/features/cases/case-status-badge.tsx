'use client';

import { CASE_STATUS_LABELS, CaseStatus } from '@vet-plan/shared';
import { Badge } from '@vet-plan/ui';
import type { BadgeTone } from '@vet-plan/ui';

const TONES: Record<CaseStatus, BadgeTone> = {
    [CaseStatus.PLANNING]: 'outline',
    [CaseStatus.PLANNED]: 'brand',
    [CaseStatus.COMPLETED]: 'success',
    [CaseStatus.CANCELLED]: 'muted',
};

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
    return <Badge label={CASE_STATUS_LABELS[status]} tone={TONES[status]} />;
}
