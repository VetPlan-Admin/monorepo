# @vet-plan/mobile

Expo SDK 58 app (Expo Router + NativeWind v5 RC) that renders the shared screens from
`@vet-plan/app`. Architecture and rules: `docs/ARCHITECTURE.md` §4.

## Run
```bash
pnpm install                              # from the repo root
pnpm --filter @vet-plan/mobile dev        # Expo dev server → scan the QR code with Expo Go
```
The app calls the backend at `EXPO_PUBLIC_API_URL` (default `http://localhost:4000`). On a
physical device `localhost` is the phone itself, so create `apps/mobile/.env.local`:
```bash
EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:4000
```
Native requests don't send an `Origin` header, so the backend's CORS setting doesn't affect the app.

## Layout
| Path | Purpose |
|---|---|
| `src/app/_layout.tsx` | Imports `global.css`; mounts `ApiProvider` and `NavigationProvider` |
| `src/app/index.tsx`, `src/app/cases.tsx` | Thin routes rendering `HomeScreen` / `CasesScreen` |
| `src/navigation.tsx` | Adapts Expo Router's `Link` to `@vet-plan/app`'s `Link` |
| `src/global.css` | NativeWind theme, brand tokens, `@source` for `packages/ui` and `packages/app` |
| `metro.config.js` | `withNativewind(getDefaultConfig(__dirname))`. Monorepo resolution is automatic |
| `nativewind-env.d.ts`, `css-modules.d.ts` | `className` types and CSS import declaration |

## Rules
- Add dependencies with `pnpm --filter @vet-plan/mobile exec expo install <pkg>`.
- React (19.3.0) and React Native (0.88.0) must stay identical across the repo.
- NativeWind is a pre-release pair: `nativewind@5.0.0-rc.0` + `react-native-css@3.1.0-rc.0`, Tailwind
  `4.1.12`, and `lightningcss@1.30.1` (scoped `overrides` in `pnpm-workspace.yaml`). Upgrade them together.
- `pnpm lint` runs `tsc --noEmit && expo lint` here.

## Verify without a device
```bash
cd apps/mobile && npx expo export --platform android --platform ios --output-dir /tmp/vetplan-export
```
This bundles the app with Metro (NativeWind compilation, monorepo resolution, shared packages).
Runtime behaviour still needs Expo Go or a development build.

## Cost notes ($0 boundary)
Expo Go, development builds and `eas build --local` are free; EAS cloud builds have a free monthly
quota. Publishing is the only paid step: Apple Developer Program $99/year, Google Play $25 one-time.
