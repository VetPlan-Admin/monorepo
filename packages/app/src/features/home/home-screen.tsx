'use client';

import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Link } from '../../navigation/link';
import { Button } from '@vet-plan/ui';
import { useApiHealth } from './use-api-health';
import type { ApiHealthStatus } from './use-api-health';

const STATUS_LABELS: Record<ApiHealthStatus, string> = {
    checking: 'Checking API…',
    online: 'API online',
    offline: 'API offline',
};

const STATUS_DOTS: Record<ApiHealthStatus, string> = {
    checking: 'bg-brand-yellow/50',
    online: 'bg-green-400',
    offline: 'bg-red-400',
};

export interface HomeScreenProps {
    /** Platform-specific session UI (web: signed-in user + sign out). */
    session?: ReactNode;
}

export function HomeScreen({ session }: HomeScreenProps) {
    const { status, refresh } = useApiHealth();

    return (
        <View className="flex-1 items-center justify-center gap-6 bg-brand-purple px-4 py-16">
            <Text className="text-4xl font-bold text-brand-yellow">Vet Plan</Text>
            <Text className="text-center text-base text-brand-yellow/80">
                Orthopedic surgical planning for veterinary clinics
            </Text>

            <View className="flex-row items-center gap-2" accessibilityLiveRegion="polite">
                <View className={`h-2.5 w-2.5 rounded-full ${STATUS_DOTS[status]}`} />
                <Text className="text-sm text-brand-yellow">{STATUS_LABELS[status]}</Text>
            </View>

            {session}

            <View className="flex-row flex-wrap items-center justify-center gap-3">
                <Link href="/cases">
                    <View className="rounded-full bg-brand-yellow px-6 py-3">
                        <Text className="text-base font-semibold text-brand-purple">Open cases</Text>
                    </View>
                </Link>
                <Button label="Re-check API" variant="outline" onPress={refresh} disabled={status === 'checking'} />
            </View>
        </View>
    );
}
