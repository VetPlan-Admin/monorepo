# @vet-plan/ui (planned): Cross-Platform UI Primitives

> **Status:** not created yet. This README is the bootstrap guide for ROADMAP Phase 2.1–2.2.
> There is no `package.json` yet, so pnpm and Turbo ignore this folder.

Shared, brand-styled building blocks (Button, Card, Input) written with React Native
primitives + NativeWind `className`. Expo renders them natively; Next.js renders them
through `react-native-web`. Layering rules: `docs/ARCHITECTURE.md` §4.

## Step 1: Create the package
`packages/ui/package.json`:
```json
{
  "name": "@vet-plan/ui",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc --noEmit" },
  "dependencies": { "@vet-plan/tokens": "workspace:*" },
  "peerDependencies": { "react": "^19.3.0", "react-native": "*", "nativewind": "*" },
  "devDependencies": { "typescript": "^5.4.0", "@types/react": "^19" }
}
```
The package ships **TypeScript source** (no build step). Next.js compiles it via
`transpilePackages`, and Metro compiles it natively.

`packages/ui/tsconfig.json`: use bundler resolution (no `.js` import suffixes here):
```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "esnext", "moduleResolution": "bundler",
    "jsx": "react-jsx", "strict": true, "noEmit": true, "skipLibCheck": true
  },
  "include": ["src"]
}
```
Add NativeWind's TypeScript reference (see its docs) so `className` type-checks on RN components.

## Step 2: First primitive
`src/button.tsx`:
```tsx
import { Pressable, Text } from 'react-native';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
}

export function Button({ label, onPress }: ButtonProps) {
  return (
    <Pressable onPress={onPress} className="rounded-full bg-brand-yellow px-5 py-3">
      <Text className="font-semibold text-brand-purple">{label}</Text>
    </Pressable>
  );
}
```
`src/index.ts`: `export * from './button';`

Platform-specific variants: `button.web.tsx` / `button.native.tsx` next to the shared file.

## Step 3: Wire into apps/frontend (Next.js 16)
```bash
pnpm --filter @vet-plan/frontend add @vet-plan/ui@workspace:* react-native-web nativewind@5.0.0-rc.0
```
`apps/frontend/next.config.ts`: add to the existing config:
```ts
transpilePackages: ['@vet-plan/ui', '@vet-plan/app', 'solito', 'react-native-web', 'nativewind'],
turbopack: {
  resolveAlias: { 'react-native': 'react-native-web' },
  resolveExtensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
  rules: { /* keep the existing *.css rule */ },
},
```
`apps/frontend/src/app/globals.css`: Tailwind only scans the app folder by default:
```css
@source "../../../../packages/ui/src";
@source "../../../../packages/app/src";
```
Render `<Button label="Start planning" />` in a `'use client'` component on the home page.

## Done when
- [ ] `pnpm build && pnpm lint` pass
- [ ] Button shows purple-on-yellow on the web home page
- [ ] No imports from `next/*`, `expo-*`, or `apps/*` inside this package
