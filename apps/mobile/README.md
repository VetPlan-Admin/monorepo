# @vet-plan/mobile (planned): Expo SDK 58 + Expo Router + NativeWind

> **Status:** not created yet. This README is the bootstrap guide for ROADMAP Phase 2.4.
> Do Phase 2.1–2.3 first (`packages/ui`, `packages/app`).
> There is no `package.json` yet, so pnpm and Turbo ignore this folder.

## Step 1: Scaffold
`create-expo-app` needs an empty target folder, so move this README out first:
```bash
mv apps/mobile/README.md /tmp/mobile-README.md
pnpm dlx create-expo-app@latest apps/mobile --template default@sdk-58 --no-install
mv /tmp/mobile-README.md apps/mobile/README.md
```

## Step 2: Join the workspace
Edit `apps/mobile/package.json`:
- `"name": "@vet-plan/mobile"`
- scripts: `"dev": "expo start"`, `"lint": "expo lint"`. Add no `build` script: native builds go through
  `eas build`, so `pnpm build` skips mobile.
- dependencies: `"@vet-plan/app": "workspace:*"`, `"@vet-plan/ui": "workspace:*"`,
  `"@vet-plan/tokens": "workspace:*"`, `"@vet-plan/shared": "workspace:*"`, `"solito": "5.0.0"`

Then from the repo root: `pnpm install`.

Keep `react` on the version Expo SDK 58 pins (React Native 0.88 → React ^19.3) and keep
`apps/frontend` on the same minor.

## Step 3: NativeWind v5 (Tailwind v4)
Follow the official NativeWind **v5** Expo installation guide. As of `5.0.0-rc.0` it is built on
`react-native-css` + Tailwind v4 and sets up `metro.config.js`, PostCSS, and `global.css`.
Install with `pnpm --filter @vet-plan/mobile exec expo install …` so versions match the SDK, and
pin `nativewind@5.0.0-rc.0` exactly.

Then add the shared tokens and sources to the `global.css` the guide creates:
```css
@import "@vet-plan/tokens/theme.css";
@source "../../packages/ui/src";
@source "../../packages/app/src";
```
**Fallback** if v5 RC blocks you: NativeWind `4.2.x` (stable) with Tailwind **v3** inside
`apps/mobile` only. Copy the `colors.brand` values from `@vet-plan/tokens` into its
`tailwind.config.js` `theme.extend.colors`.

## Step 4: Metro in a pnpm monorepo
Expo SDK 52+ detects workspaces automatically, so no manual `watchFolders` are needed. If Metro fails to
resolve a hoisted dependency, run `pnpm --filter @vet-plan/mobile exec expo install --check`
first. Switching pnpm to `nodeLinker: hoisted` is a last resort because it affects the whole monorepo.

## Step 5: Routes
`apps/mobile/app/` mirrors the web URLs. Route files stay thin:
```tsx
// app/index.tsx
export { HomeScreen as default } from '@vet-plan/app';
```
Later: `app/cases/index.tsx`, `app/cases/[id].tsx` (Phase 5).

## Step 6: Auth & config
- `EXPO_PUBLIC_API_URL` in `.env.example`; on a physical device use your LAN IP, not `localhost`.
- Store the JWT with `expo-secure-store`; the backend accepts `Authorization: Bearer`.
- OAuth login: `expo-auth-session` against the backend's Passport endpoints (Phase 1).

## Step 7: Run
```bash
pnpm --filter @vet-plan/mobile dev     # scan the QR code with Expo Go
```

## Cost notes ($0 boundary)
- Expo Go, development builds, and `eas build --local` are free. EAS cloud builds have a free monthly quota.
- Publishing is the only paid step: Apple Developer Program $99/year, Google Play $25 one-time.

## Done when
- [ ] `HomeScreen` from `@vet-plan/app` renders in Expo Go with brand colors
- [ ] Navigating to `/cases` works on device
- [ ] `pnpm lint` includes `@vet-plan/mobile` and passes
