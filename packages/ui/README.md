# @vet-plan/ui

Cross-platform UI primitives built from React Native components + `className`. Expo renders them
natively (NativeWind v5); Next.js renders them through react-native-web. Ships TypeScript source
(no build step). Rules: `docs/ARCHITECTURE.md` §4.

## Contents
| Export | Purpose |
|---|---|
| `Button` | Brand button: `variant="primary"` (purple on yellow) or `"outline"`; all `Pressable` props |
| `Badge` | Small status pill: `tone` = `brand`, `outline`, `success`, `muted` |
| `TextField` | Labelled `TextInput` with an optional `error` message (`multiline` supported) |
| `ChoiceChips` | Single-choice chips (cross-platform `<select>`); `allowDeselect` for optional fields |
| `@vet-plan/ui/react-native-web-shim` | **Web only.** `apps/frontend` aliases `react-native` to it. Re-exports react-native-web and adds `className` support to `View`, `Text`, `Pressable`, `ScrollView`, `Image`, `TextInput`, `ActivityIndicator` |

## Adding a component
1. Create `src/<name>.tsx` with React Native primitives and Tailwind classes written as **complete
   literal strings** (Tailwind and NativeWind scan source; `bg-${color}` won't be generated).
2. Export it from `src/index.ts`.
3. Platform differences: add `src/<name>.native.tsx`. The plain file is the web version.
4. Using another RN core component with `className` on web? Wrap it in the shim with `withClassName`.
5. `pnpm --filter @vet-plan/ui lint` (type-check), then check both apps.

Don't import `next/*`, `expo-*`, `@vet-plan/app`, or app folders from here.
