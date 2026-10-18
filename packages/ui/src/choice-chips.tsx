import { Pressable, Text, View } from 'react-native';

export interface ChoiceOption<T extends string> {
    value: T;
    label: string;
}

export interface ChoiceChipsProps<T extends string> {
    label?: string;
    options: readonly ChoiceOption<T>[];
    value: T | null;
    onChange: (value: T | null) => void;
    /** Pressing the selected chip clears the choice. */
    allowDeselect?: boolean;
    error?: string;
}

/** Single-choice chips: the cross-platform replacement for a <select>. */
export function ChoiceChips<T extends string>({ label, options, value, onChange, allowDeselect = false, error }: ChoiceChipsProps<T>) {
    return (
        <View className="gap-1">
            {label ? <Text className="text-sm font-medium text-brand-yellow/90">{label}</Text> : null}
            <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
                {options.map((option) => {
                    const selected = option.value === value;
                    return (
                        <Pressable
                            key={option.value}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: selected }}
                            onPress={() => onChange(selected && allowDeselect ? null : option.value)}
                            className={`rounded-full border px-3 py-1.5 ${
                                selected ? 'border-brand-yellow bg-brand-yellow' : 'border-brand-yellow/40'
                            }`}
                        >
                            <Text className={`text-sm ${selected ? 'font-semibold text-brand-purple' : 'text-brand-yellow'}`}>
                                {option.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
            {error ? <Text className="text-xs text-red-300">{error}</Text> : null}
        </View>
    );
}
