import { Pressable, Text } from 'react-native';
import type { PressableProps } from 'react-native';

const VARIANTS = {
    primary: { container: 'bg-brand-yellow', label: 'text-brand-purple' },
    outline: { container: 'border border-brand-yellow', label: 'text-brand-yellow' },
} as const;

export interface ButtonProps extends Omit<PressableProps, 'children'> {
    label: string;
    variant?: keyof typeof VARIANTS;
}

/** High-contrast brand button (purple on yellow by default). */
export function Button({ label, variant = 'primary', className, disabled, ...props }: ButtonProps) {
    const styles = VARIANTS[variant];
    return (
        <Pressable
            accessibilityRole="button"
            disabled={disabled}
            className={`items-center justify-center rounded-full px-6 py-3 ${styles.container} ${disabled ? 'opacity-50' : ''} ${className ?? ''}`}
            {...props}
        >
            <Text className={`text-base font-semibold ${styles.label}`}>{label}</Text>
        </Pressable>
    );
}
