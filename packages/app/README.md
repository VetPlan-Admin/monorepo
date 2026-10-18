# @vet-plan/app (planned): Cross-Platform Screens & Features

> **Status:** not created yet. This README is the bootstrap guide for ROADMAP Phase 2.3.
> There is no `package.json` yet, so pnpm and Turbo ignore this folder.

Screens and feature logic shared by `apps/frontend` (Next.js) and `apps/mobile` (Expo Router).
Apps only contain thin route files that render these screens. Navigation goes through
**Solito 5** so the same code works with both routers. Rules: `docs/ARCHITECTURE.md` §4.

## Step 1: Create the package
`packages/app/package.json`:
```json
{
  "name": "@vet-plan/app",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc --noEmit" },
  "dependencies": {
    "@vet-plan/shared": "workspace:*",
    "@vet-plan/tokens": "workspace:*",
    "@vet-plan/ui": "workspace:*"
  },
  "peerDependencies": { "react": "^19.3.0", "react-native": "*", "solito": "^5.0.0" },
  "devDependencies": { "typescript": "^5.4.0", "@types/react": "^19" }
}
```
Copy `tsconfig.json` from `packages/ui` (bundler resolution, `jsx: react-jsx`).

## Step 2: Folder layout
```
packages/app/src/
├── features/
│   ├── home/home-screen.tsx
│   └── cases/                  # Phase 5: cases-list-screen.tsx, case-detail-screen.tsx
├── lib/
│   └── api-client.ts           # fetch wrapper; base URL + token getter injected by each app
└── index.ts
```

## Step 3: First screen
`src/features/home/home-screen.tsx`:
```tsx
'use client';
import { View, Text } from 'react-native';
import { Link } from 'solito/link';
import { Button } from '@vet-plan/ui';

export function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center gap-6 bg-brand-purple p-6">
      <Text className="text-3xl font-bold text-brand-yellow">Vet Plan</Text>
      <Link href="/cases">
        <Button label="Open cases" />
      </Link>
    </View>
  );
}
```

## Step 4: API client (shared by web and mobile)
- Base URL is injected by each app: `process.env.NEXT_PUBLIC_API_URL` (web) and
  `process.env.EXPO_PUBLIC_API_URL` (mobile). Add both keys to `.env.example`.
- Token getter is injected too: web relies on the HTTP-only cookie (Next.js route handler
  forwards it as `Authorization: Bearer`), mobile reads `expo-secure-store`.
- Request/response types come from `@vet-plan/shared` DTOs. Never redeclare them here.
- First call: `GET /health` (public) to prove connectivity.

## Step 5: Route it in both apps
- Web: `apps/frontend/src/app/page.tsx` → `export { HomeScreen as default } from '@vet-plan/app';`
- Mobile: `apps/mobile/app/index.tsx` → same re-export.

## Done when
- [ ] Same `HomeScreen` renders on web and in Expo Go
- [ ] `Link href="/cases"` navigates on both platforms
- [ ] No imports from `next/*`, `expo-router`, or `apps/*` inside this package
