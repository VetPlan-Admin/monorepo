'use client';

import { Text, View } from 'react-native';
import { Link } from '../../navigation/link';

/** Placeholder until surgical case management (ROADMAP Phase 5). Proves shared routing. */
export function CasesScreen() {
    return (
        <View className="flex-1 items-center justify-center gap-4 bg-brand-purple px-4 py-16">
            <Text className="text-3xl font-bold text-brand-yellow">Cases</Text>
            <Text className="text-center text-base text-brand-yellow/80">
                Surgical case management arrives in Phase 5.
            </Text>
            <Link href="/">
                <Text className="text-base text-brand-yellow underline">Back to home</Text>
            </Link>
        </View>
    );
}
