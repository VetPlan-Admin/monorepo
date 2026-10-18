'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import {
    CaseStatus,
    formatMeasurementValue,
    getMeasurementDefinition,
    isCaseEditable,
    LIMB_LABELS,
    PATIENT_SEX_LABELS,
    PLANNING_ROLES,
    PROCEDURE_TYPE_LABELS,
    SPECIES_LABELS,
} from '@vet-plan/shared';
import type { CaseDetailDto, RadiographPlanDto } from '@vet-plan/shared';
import { Button, TextField } from '@vet-plan/ui';
import { Card, ErrorMessage, Field, Loading, Screen, SectionTitle } from '../../components/screen';
import { describeApiError } from '../../lib/api-client';
import { useApiQuery } from '../../lib/use-api-query';
import { Link } from '../../navigation/link';
import { useApiClient } from '../../provider/api-provider';
import { CaseStatusBadge } from './case-status-badge';

const TRANSITION_LABELS: Record<CaseStatus, string> = {
    [CaseStatus.PLANNING]: 'Back to planning',
    [CaseStatus.PLANNED]: 'Mark as planned',
    [CaseStatus.COMPLETED]: 'Mark as completed',
    [CaseStatus.CANCELLED]: 'Cancel case',
};

export interface CaseDetailScreenProps {
    caseId: string;
    /** Platform extras next to the case header (web: open planner, download report). */
    renderCaseActions?: (detail: CaseDetailDto) => ReactNode;
    /** Platform extras per plan (web: reopen in planner). */
    renderPlanActions?: (detail: CaseDetailDto, plan: RadiographPlanDto) => ReactNode;
}

function PlanCard({ plan, actions, onDelete }: { plan: RadiographPlanDto; actions?: ReactNode; onDelete?: () => Promise<void> }) {
    const [confirming, setConfirming] = useState(false);
    return (
        <Card>
            <View className="flex-row flex-wrap items-center justify-between gap-2">
                <Text className="text-lg font-semibold text-brand-yellow">{plan.label}</Text>
                <View className="flex-row flex-wrap gap-2">
                    {actions}
                    {onDelete ? (
                        <Button
                            label={confirming ? 'Confirm delete' : 'Delete'}
                            variant="outline"
                            onPress={() => (confirming ? void onDelete() : setConfirming(true))}
                        />
                    ) : null}
                </View>
            </View>
            <Text className="text-xs text-brand-yellow/70">
                {plan.imageWidth} × {plan.imageHeight} px ·{' '}
                {plan.calibration ? `${plan.calibration.mmPerPixel.toFixed(4)} mm/px (${plan.calibration.source})` : 'not calibrated'} · saved{' '}
                {new Date(plan.updatedAt).toLocaleString()}
                {plan.createdBy ? ` by ${plan.createdBy.displayName}` : ''}
            </Text>
            {plan.results.map((result) => (
                <View key={result.id} className="gap-1 border-t border-brand-yellow/10 pt-2">
                    <Text className="font-medium text-brand-yellow">{getMeasurementDefinition(result.type).name}</Text>
                    {result.values.map((value) => (
                        <View key={value.key} className="flex-row justify-between">
                            <Text className="text-sm text-brand-yellow/80">{value.label}</Text>
                            <Text className="text-sm font-semibold text-brand-yellow">
                                {formatMeasurementValue(value)}
                                {value.assessment ? (value.assessment === 'within-limits' ? ' · normal' : ' · reduced') : ''}
                            </Text>
                        </View>
                    ))}
                    {result.message ? <Text className="text-sm text-red-200">{result.message}</Text> : null}
                    {result.warnings.map((warning) => (
                        <Text key={warning} className="text-xs text-amber-200">
                            ⚠ {warning}
                        </Text>
                    ))}
                </View>
            ))}
        </Card>
    );
}

/** Patient + case information, status workflow, notes and saved radiograph plans. */
export function CaseDetailScreen({ caseId, renderCaseActions, renderPlanActions }: CaseDetailScreenProps) {
    const client = useApiClient();
    const detail = useApiQuery(`case:${caseId}`, (api, signal) => api.getCase(caseId, signal));
    const me = useApiQuery('me', (api, signal) => api.getCurrentUser(signal));
    const [notes, setNotes] = useState<string | null>(null);
    const [actionError, setActionError] = useState<unknown>(null);
    const [busy, setBusy] = useState(false);

    async function run(action: () => Promise<unknown>) {
        setBusy(true);
        setActionError(null);
        try {
            await action();
            setNotes(null);
            detail.reload();
        } catch (error) {
            setActionError(error);
        } finally {
            setBusy(false);
        }
    }

    if (detail.error) {
        return (
            <Screen>
                <Link href="/cases">
                    <Text className="text-sm text-brand-yellow underline">← All cases</Text>
                </Link>
                <ErrorMessage error={detail.error} />
            </Screen>
        );
    }
    if (!detail.data) {
        return (
            <Screen>
                <Loading />
            </Screen>
        );
    }

    const data = detail.data;
    const { patient } = data;
    const canPlan = !!me.data && PLANNING_ROLES.includes(me.data.role);
    const editable = isCaseEditable(data.status);

    return (
        <Screen>
            <View className="gap-1">
                <Link href="/cases">
                    <Text className="text-sm text-brand-yellow underline">← All cases</Text>
                </Link>
                <View className="flex-row flex-wrap items-center gap-3">
                    <Text className="text-3xl font-bold text-brand-yellow">{patient.name}</Text>
                    <CaseStatusBadge status={data.status} />
                </View>
                <Text className="text-brand-yellow/80">
                    {[PROCEDURE_TYPE_LABELS[data.procedureType], data.limb && LIMB_LABELS[data.limb], data.surgeryDate && `Surgery ${data.surgeryDate}`]
                        .filter(Boolean)
                        .join(' · ')}
                </Text>
            </View>

            {renderCaseActions ? <View className="flex-row flex-wrap gap-2">{renderCaseActions(data)}</View> : null}

            {canPlan && data.allowedTransitions.length > 0 ? (
                <View className="flex-row flex-wrap gap-2">
                    {data.allowedTransitions.map((status) => (
                        <Button
                            key={status}
                            label={TRANSITION_LABELS[status]}
                            variant={status === CaseStatus.CANCELLED ? 'outline' : 'primary'}
                            disabled={busy}
                            onPress={() => void run(() => client.updateCase(caseId, { status }))}
                        />
                    ))}
                </View>
            ) : null}
            {actionError ? <ErrorMessage error={describeApiError(actionError)} /> : null}

            <Card>
                <SectionTitle>Patient</SectionTitle>
                <Field label="Species" value={SPECIES_LABELS[patient.species]} />
                <Field label="Breed" value={patient.breed} />
                <Field label="Sex" value={patient.sex && PATIENT_SEX_LABELS[patient.sex]} />
                <Field label="Date of birth" value={patient.dateOfBirth} />
                <Field label="Weight" value={patient.weightKg !== null ? `${patient.weightKg} kg` : null} />
                <Field label="Owner" value={patient.ownerName} />
                <Field label="Record number" value={patient.externalId} />
            </Card>

            <Card>
                <SectionTitle>Notes</SectionTitle>
                {canPlan ? (
                    <View className="gap-2">
                        <TextField label="Case notes" multiline value={notes ?? data.notes ?? ''} onChangeText={setNotes} />
                        {notes !== null && notes !== (data.notes ?? '') ? (
                            <Button
                                label="Save notes"
                                disabled={busy}
                                onPress={() => void run(() => client.updateCase(caseId, { notes: notes.trim() || null }))}
                            />
                        ) : null}
                    </View>
                ) : (
                    <Text className="text-brand-yellow/90">{data.notes || 'No notes.'}</Text>
                )}
                <Text className="text-xs text-brand-yellow/60">
                    Created {new Date(data.createdAt).toLocaleString()}
                    {data.createdBy ? ` by ${data.createdBy.displayName}` : ''}
                </Text>
            </Card>

            <SectionTitle>Radiograph plans ({data.plans.length})</SectionTitle>
            {data.plans.length === 0 ? (
                <Text className="text-brand-yellow/80">
                    No plans yet.{editable ? ' Measure a radiograph in the planner and save it to this case.' : ''}
                </Text>
            ) : null}
            {data.plans.map((plan) => (
                <PlanCard
                    key={plan.id}
                    plan={plan}
                    actions={renderPlanActions?.(data, plan)}
                    onDelete={canPlan && editable ? () => run(() => client.deletePlan(caseId, plan.id)) : undefined}
                />
            ))}
        </Screen>
    );
}
