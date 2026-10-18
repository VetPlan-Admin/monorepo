import { Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { colors } from '@vet-plan/tokens';

export interface TextFieldProps extends Omit<TextInputProps, 'className'> {
    label: string;
    error?: string;
}

/** Labelled text input in brand colours, with an optional validation message. */
export function TextField({ label, error, multiline, ...props }: TextFieldProps) {
    return (
        <View className="gap-1">
            <Text className="text-sm font-medium text-brand-yellow/90">{label}</Text>
            <TextInput
                accessibilityLabel={label}
                placeholderTextColor={`${colors.brand.yellow}80`}
                multiline={multiline}
                className={`rounded-lg border bg-black/30 px-3 py-2 text-base text-brand-yellow ${
                    error ? 'border-red-400' : 'border-brand-yellow/40'
                } ${multiline ? 'min-h-20' : ''}`}
                {...props}
            />
            {error ? <Text className="text-xs text-red-300">{error}</Text> : null}
        </View>
    );
}
