# @vet-plan/app

Screens and feature logic shared by `apps/frontend` (Next.js) and `apps/mobile` (Expo Router).
Apps keep only thin route files and providers. Ships TypeScript source. Rules: `docs/ARCHITECTURE.md` §4.

## Contents
| Export | Purpose |
|---|---|
| `HomeScreen` | Title, API health badge, links. `session` prop is a slot for platform session UI |
| `CasesScreen` | Placeholder for Phase 5 |
| `createApiClient`, `ApiClient`, `ApiError` | Typed fetch client; DTOs from `@vet-plan/shared` |
| `ApiProvider`, `useApiClient` | Provides the client (`baseUrl` from each app) |
| `useApiHealth` | `GET /health` status + `refresh()` |
| `NavigationProvider`, `Link`, `LinkProps` | Solito-style navigation: screens use `Link href="/cases"`; each app injects its router's link |

## Adding a screen
1. `src/features/<feature>/<name>-screen.tsx`, starting with `'use client'`.
2. Use RN primitives + `className`, `Button` etc. from `@vet-plan/ui`, `Link` from
   `../../navigation/link`, data via `useApiClient()`.
3. Export from `src/index.ts`.
4. Route it in both apps with the **same URL**:
   - web: `apps/frontend/src/app/(dashboard)/<route>/page.tsx` → `return <XScreen />`
   - mobile: `apps/mobile/src/app/<route>.tsx` → `return <XScreen />`
5. Add endpoints to `api-client.ts` with request/response types from `@vet-plan/shared`.

Authenticated calls: pass `getAccessToken` to `createApiClient` (mobile: `expo-secure-store`).
On web, keep authenticated reads in server components (the token lives in an HTTP-only cookie)
and pass the data to screens as props.
