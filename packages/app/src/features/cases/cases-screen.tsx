'use client';

import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { CASE_STATUS_LABELS, CaseStatus, LIMB_LABELS, PROCEDURE_TYPE_LABELS, ProcedureType, SPECIES_LABELS } from '@vet-plan/shared';
import type { CaseSummaryDto } from '@vet-plan/shared';
import { Button, ChoiceChips, TextField } from '@vet-plan/ui';
import { Card, ErrorMessage, Loading, Screen } from '../../components/screen';
import { useApiQuery } from '../../lib/use-api-query';
import { Link } from '../../navigation/link';
import { CaseStatusBadge } from './case-status-badge';

const PAGE_SIZE = 20;
const statusOptions = Object.values(CaseStatus).map((value) => ({ value, label: CASE_STATUS_LABELS[value] }));
const procedureOptions = Object.values(ProcedureType).map((value) => ({ value, label: PROCEDURE_TYPE_LABELS[value] }));

function CaseRow({ surgicalCase }: { surgicalCase: CaseSummaryDto }) {
    const { patient } = surgicalCase;
    const details = [
        PROCEDURE_TYPE_LABELS[surgicalCase.procedureType],
        surgicalCase.limb && LIMB_LABELS[surgicalCase.limb],
        surgicalCase.surgeryDate && `Surgery ${surgicalCase.surgeryDate}`,
        `${surgicalCase.planCount} plan${surgicalCase.planCount === 1 ? '' : 's'}`,
    ].filter(Boolean);
    return (
        <Link href={`/cases/${surgicalCase.id}`}>
            <Card>
                <View className="flex-row items-center justify-between gap-3">
                    <Text className="text-lg font-semibold text-brand-yellow">{patient.name}</Text>
                    <CaseStatusBadge status={surgicalCase.status} />
                </View>
                <Text className="text-sm text-brand-yellow/80">
                    {[SPECIES_LABELS[patient.species], patient.breed, patient.ownerName && `Owner: ${patient.ownerName}`]
                        .filter(Boolean)
                        .join(' · ')}
                </Text>
                <Text className="text-sm text-brand-yellow/80">{details.join(' · ')}</Text>
            </Card>
        </Link>
    );
}

/** Case history: search by patient, owner or record number; filter by status and procedure. */
export function CasesScreen() {
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [status, setStatus] = useState<CaseStatus | null>(null);
    const [procedureType, setProcedureType] = useState<ProcedureType | null>(null);
    const [page, setPage] = useState(1);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => clearTimeout(timer);
    }, [search]);

    const query = {
        search: debouncedSearch || undefined,
        status: status ?? undefined,
        procedureType: procedureType ?? undefined,
        page,
        pageSize: PAGE_SIZE,
    };
    const { data, error, loading } = useApiQuery(JSON.stringify(query), (client, signal) => client.listCases(query, signal));
    const pageCount = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

    return (
        <Screen>
            <View className="flex-row flex-wrap items-center justify-between gap-3">
                <View>
                    <Text className="text-3xl font-bold text-brand-yellow">Cases</Text>
                    <Link href="/">
                        <Text className="text-sm text-brand-yellow underline">Home</Text>
                    </Link>
                </View>
                <Link href="/cases/new">
                    <View className="rounded-full bg-brand-yellow px-5 py-2.5">
                        <Text className="font-semibold text-brand-purple">New case</Text>
                    </View>
                </Link>
            </View>

            <TextField
                label="Search"
                placeholder="Patient, owner or record number"
                value={search}
                onChangeText={(text) => {
                    setSearch(text);
                    setPage(1);
                }}
            />
            <ChoiceChips label="Status" options={statusOptions} value={status} allowDeselect onChange={(value) => { setStatus(value); setPage(1); }} />
            <ChoiceChips label="Procedure" options={procedureOptions} value={procedureType} allowDeselect onChange={(value) => { setProcedureType(value); setPage(1); }} />

            {error ? <ErrorMessage error={error} /> : null}
            {loading ? <Loading /> : null}
            {data && data.items.length === 0 ? (
                <Text className="py-6 text-center text-brand-yellow/80">
                    {query.search || status || procedureType ? 'No cases match these filters.' : 'No cases yet. Create the first one.'}
                </Text>
            ) : null}
            {data ? (
                <View className="gap-3">
                    {data.items.map((surgicalCase) => (
                        <CaseRow key={surgicalCase.id} surgicalCase={surgicalCase} />
                    ))}
                </View>
            ) : null}

            {data && pageCount > 1 ? (
                <View className="flex-row items-center justify-center gap-3">
                    <Button label="Previous" variant="outline" disabled={page <= 1} onPress={() => setPage(page - 1)} />
                    <Text className="text-brand-yellow">
                        Page {page} of {pageCount}
                    </Text>
                    <Button label="Next" variant="outline" disabled={page >= pageCount} onPress={() => setPage(page + 1)} />
                </View>
            ) : null}
        </Screen>
    );
}
