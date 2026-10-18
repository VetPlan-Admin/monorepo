import { Text, View } from 'react-native';

const TONES = {
    brand: { container: 'bg-brand-yellow', text: 'text-brand-purple' },
    outline: { container: 'border border-brand-yellow', text: 'text-brand-yellow' },
    success: { container: 'bg-green-400/20', text: 'text-green-200' },
    muted: { container: 'bg-white/10', text: 'text-white/70' },
} as const;

export type BadgeTone = keyof typeof TONES;

export function Badge({ label, tone = 'outline' }: { label: string; tone?: BadgeTone }) {
    return (
        <View className={`self-start rounded-full px-2.5 py-0.5 ${TONES[tone].container}`}>
            <Text className={`text-xs font-semibold ${TONES[tone].text}`}>{label}</Text>
        </View>
    );
}
