'use client';

import type { ReactNode } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { colors } from '@vet-plan/tokens';
import { describeApiError } from '../lib/api-client';

/** Scrollable brand-purple page with a centred, readable column. */
export function Screen({ children }: { children: ReactNode }) {
    return (
        <ScrollView className="flex-1 bg-brand-purple">
            <View className="w-full max-w-3xl self-center gap-5 px-4 py-6">{children}</View>
        </ScrollView>
    );
}

export function Card({ children }: { children: ReactNode }) {
    return <View className="gap-2 rounded-xl border border-brand-yellow/20 bg-black/20 p-4">{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
    return <Text className="text-sm font-semibold uppercase tracking-wide text-brand-yellow/70">{children}</Text>;
}

export function Loading() {
    return (
        <View className="items-center py-8">
            <ActivityIndicator color={colors.brand.yellow} />
        </View>
    );
}

export function ErrorMessage({ error }: { error: unknown }) {
    return (
        <Text accessibilityRole="alert" className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">
            {typeof error === 'string' ? error : describeApiError(error)}
        </Text>
    );
}

/** Label/value row for detail cards. */
export function Field({ label, value }: { label: string; value: string | null | undefined }) {
    return (
        <View className="flex-row justify-between gap-4">
            <Text className="text-sm text-brand-yellow/70">{label}</Text>
            <Text className="flex-1 text-right text-sm text-brand-yellow">{value || '—'}</Text>
        </View>
    );
}
