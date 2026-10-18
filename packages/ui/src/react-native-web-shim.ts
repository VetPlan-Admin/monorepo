// Web only: apps/frontend aliases `react-native` to this module (see next.config.ts).
//
// On native, NativeWind v5 (react-native-css) turns `className` into styles through Metro.
// NativeWind has no Next.js/Turbopack integration yet, and react-native-web ignores `className`,
// so on web we forward it as a react-native-web "compiled style" (`{ $$css: true }`), which
// react-native-web renders as a DOM class. Tailwind in apps/frontend generates the CSS.
import { createElement } from 'react';
import type { ComponentType } from 'react';
import {
    ActivityIndicator as RNWActivityIndicator,
    Image as RNWImage,
    Pressable as RNWPressable,
    ScrollView as RNWScrollView,
    Text as RNWText,
    TextInput as RNWTextInput,
    View as RNWView,
} from 'react-native-web';

export * from 'react-native-web';

interface ClassNameProps {
    className?: string;
    style?: unknown;
}

type PressableStyle = (state: unknown) => unknown;

function withClassName<P extends object>(Component: ComponentType<P>, name: string): ComponentType<P & ClassNameProps> {
    function ClassNameComponent({ className, style, ...rest }: P & ClassNameProps) {
        const compiled = className ? { $$css: true, className } : undefined;
        const merged = !compiled
            ? style
            : typeof style === 'function'
              ? (state: unknown) => [compiled, (style as PressableStyle)(state)]
              : [compiled, style];
        return createElement(Component, { ...(rest as P), style: merged });
    }
    ClassNameComponent.displayName = name;
    return ClassNameComponent;
}

export const ActivityIndicator = withClassName(RNWActivityIndicator, 'ActivityIndicator');
export const Image = withClassName(RNWImage, 'Image');
export const Pressable = withClassName(RNWPressable, 'Pressable');
export const ScrollView = withClassName(RNWScrollView, 'ScrollView');
export const Text = withClassName(RNWText, 'Text');
export const TextInput = withClassName(RNWTextInput, 'TextInput');
export const View = withClassName(RNWView, 'View');
