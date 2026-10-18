'use client';

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
    createCaseSchema,
    createPatientSchema,
    Limb,
    LIMB_LABELS,
    PATIENT_SEX_LABELS,
    PatientSex,
    PROCEDURE_TYPE_LABELS,
    ProcedureType,
    Species,
    SPECIES_LABELS,
} from '@vet-plan/shared';
import type { PatientDto } from '@vet-plan/shared';
import { Button, ChoiceChips, TextField } from '@vet-plan/ui';
import { Card, ErrorMessage, Loading, Screen, SectionTitle } from '../../components/screen';
import { ApiError, describeApiError } from '../../lib/api-client';
import { useApiQuery } from '../../lib/use-api-query';
import { Link, useNavigate } from '../../navigation/link';
import { useApiClient } from '../../provider/api-provider';

type FieldErrors = Record<string, string>;

const options = <T extends string>(labels: Readonly<Record<T, string>>) =>
    (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));

/** Empty text becomes null so optional fields stay unset. */
const orNull = (text: string) => (text.trim() === '' ? null : text.trim());

function issuesToErrors(issues: readonly { path: readonly PropertyKey[]; message: string }[], prefix = ''): FieldErrors {
    return Object.fromEntries(issues.map((issue) => [`${prefix}${String(issue.path[0] ?? '')}`, issue.message]));
}

const EMPTY_PATIENT = { name: '', species: Species.CANINE as Species | null, breed: '', sex: null as PatientSex | null, dateOfBirth: '', weightKg: '', ownerName: '', externalId: '' };

/** Create a case for an existing patient, or register the patient in the same step. */
export function NewCaseScreen() {
    const client = useApiClient();
    const navigate = useNavigate();
    const [mode, setMode] = useState<'existing' | 'new'>('existing');
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<PatientDto | null>(null);
    const [patient, setPatient] = useState(EMPTY_PATIENT);
    const [procedureType, setProcedureType] = useState<ProcedureType | null>(ProcedureType.TPLO);
    const [limb, setLimb] = useState<Limb | null>(null);
    const [surgeryDate, setSurgeryDate] = useState('');
    const [notes, setNotes] = useState('');
    const [errors, setErrors] = useState<FieldErrors>({});
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const query = { search: search.trim() || undefined, pageSize: 8 };
    const patients = useApiQuery(`patients:${JSON.stringify(query)}`, (api, signal) => api.listPatients(query, signal));

    const patientInput = {
        name: patient.name,
        species: patient.species,
        breed: orNull(patient.breed),
        sex: patient.sex,
        dateOfBirth: orNull(patient.dateOfBirth),
        weightKg: orNull(patient.weightKg) === null ? null : Number(patient.weightKg.replace(',', '.')),
        ownerName: orNull(patient.ownerName),
        externalId: orNull(patient.externalId),
    };
    const set = (field: keyof typeof EMPTY_PATIENT) => (value: string) => setPatient({ ...patient, [field]: value });

    async function submit() {
        setSubmitError(null);
        const patientCheck = mode === 'new' ? createPatientSchema.safeParse(patientInput) : null;
        const caseInput = {
            patientId: selected?.id ?? '00000000-0000-4000-8000-000000000000', // placeholder until the patient exists
            procedureType,
            limb,
            surgeryDate: orNull(surgeryDate),
            notes: orNull(notes),
        };
        const caseCheck = createCaseSchema.safeParse(caseInput);
        const nextErrors: FieldErrors = {
            ...(patientCheck && !patientCheck.success ? issuesToErrors(patientCheck.error.issues, 'patient.') : {}),
            ...(!caseCheck.success ? issuesToErrors(caseCheck.error.issues) : {}),
        };
        if (mode === 'existing' && !selected) nextErrors.patientId = 'Choose a patient';
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0 || !caseCheck.success) return;

        setSubmitting(true);
        try {
            const patientId = patientCheck?.success ? (await client.createPatient(patientCheck.data)).id : selected!.id;
            const created = await client.createCase({ ...caseCheck.data, patientId });
            navigate(`/cases/${created.id}`);
        } catch (error) {
            if (error instanceof ApiError && error.fieldErrors.length > 0) {
                setErrors(Object.fromEntries(error.fieldErrors.map((e) => [e.path.split('.')[0]!, e.message])));
            }
            setSubmitError(describeApiError(error));
            setSubmitting(false);
        }
    }

    return (
        <Screen>
            <View>
                <Link href="/cases">
                    <Text className="text-sm text-brand-yellow underline">← All cases</Text>
                </Link>
                <Text className="text-3xl font-bold text-brand-yellow">New case</Text>
            </View>

            <Card>
                <SectionTitle>Patient</SectionTitle>
                <ChoiceChips
                    options={[{ value: 'existing', label: 'Existing patient' }, { value: 'new', label: 'New patient' }]}
                    value={mode}
                    onChange={(value) => setMode(value ?? 'existing')}
                />
                {mode === 'existing' ? (
                    <View className="gap-2">
                        <TextField label="Find patient" placeholder="Name, owner or record number" value={search} onChangeText={setSearch} error={errors.patientId} />
                        {patients.error ? <ErrorMessage error={patients.error} /> : null}
                        {patients.loading ? <Loading /> : null}
                        {patients.data?.items.length === 0 ? (
                            <Text className="text-sm text-brand-yellow/80">No patients found. Register a new one.</Text>
                        ) : null}
                        {patients.data?.items.map((p) => (
                            <Pressable
                                key={p.id}
                                accessibilityRole="radio"
                                accessibilityState={{ checked: selected?.id === p.id }}
                                onPress={() => setSelected(p)}
                                className={`rounded-lg border px-3 py-2 ${selected?.id === p.id ? 'border-brand-yellow bg-brand-yellow/15' : 'border-brand-yellow/20'}`}
                            >
                                <Text className="font-semibold text-brand-yellow">{p.name}</Text>
                                <Text className="text-xs text-brand-yellow/70">
                                    {[SPECIES_LABELS[p.species], p.breed, p.ownerName, p.externalId].filter(Boolean).join(' · ')}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                ) : (
                    <View className="gap-3">
                        <TextField label="Name" value={patient.name} onChangeText={set('name')} error={errors['patient.name']} />
                        <ChoiceChips label="Species" options={options(SPECIES_LABELS)} value={patient.species} onChange={(species) => setPatient({ ...patient, species })} error={errors['patient.species']} />
                        <TextField label="Breed" value={patient.breed} onChangeText={set('breed')} error={errors['patient.breed']} />
                        <ChoiceChips label="Sex" options={options(PATIENT_SEX_LABELS)} value={patient.sex} allowDeselect onChange={(sex) => setPatient({ ...patient, sex })} />
                        <TextField label="Date of birth" placeholder="YYYY-MM-DD" value={patient.dateOfBirth} onChangeText={set('dateOfBirth')} error={errors['patient.dateOfBirth']} />
                        <TextField label="Weight (kg)" keyboardType="decimal-pad" value={patient.weightKg} onChangeText={set('weightKg')} error={errors['patient.weightKg']} />
                        <TextField label="Owner" value={patient.ownerName} onChangeText={set('ownerName')} error={errors['patient.ownerName']} />
                        <TextField label="Record number" value={patient.externalId} onChangeText={set('externalId')} error={errors['patient.externalId']} />
                    </View>
                )}
            </Card>

            <Card>
                <SectionTitle>Case</SectionTitle>
                <ChoiceChips label="Procedure" options={options(PROCEDURE_TYPE_LABELS)} value={procedureType} onChange={setProcedureType} error={errors.procedureType} />
                <ChoiceChips label="Limb" options={options(LIMB_LABELS)} value={limb} allowDeselect onChange={setLimb} />
                <TextField label="Surgery date" placeholder="YYYY-MM-DD" value={surgeryDate} onChangeText={setSurgeryDate} error={errors.surgeryDate} />
                <TextField label="Notes" multiline value={notes} onChangeText={setNotes} error={errors.notes} />
            </Card>

            {submitError ? <ErrorMessage error={submitError} /> : null}
            <Button label={submitting ? 'Creating…' : 'Create case'} disabled={submitting} onPress={() => void submit()} />
        </Screen>
    );
}
