# VetPlan — System Architecture & Data Standards

## 1. Security & RBAC Standard
- `JwtAuthGuard` and `RolesGuard` are registered globally as `APP_GUARD` providers in `app.module.ts` (JWT authentication first, then role authorization). Do NOT add `@UseGuards(JwtAuthGuard, RolesGuard)` to controllers — it runs the guards twice.
- `RolesGuard` is **deny-by-default**: every endpoint MUST declare either `@Roles(...)` (allowed roles) or `@Public()` (no authentication, e.g. `/health`, OAuth callbacks). A route with neither returns `403 Forbidden`.
- `@Roles(...)` / `@Public()` may be applied at handler or controller level; handler-level metadata overrides controller-level.
- Supported User Roles: `SUPER_ADMIN`, `CLINIC_ADMIN`, `VETERINARIAN`, `ASSISTANT`.
- JWT payload: `{ sub, tenantId, role }`. The backend reads it from the `Authorization: Bearer` header. Web keeps the token in an HTTP-only cookie (synced by Next.js); mobile keeps it in `expo-secure-store`.

## 2. Shared Workspace Packages
| Package | Contents | May import |
|---|---|---|
| `@vet-plan/shared` | DTOs, Enums (`Role`, `Species`, `ProcedureType`), pure surgical math | nothing (no React) |
| `@vet-plan/tokens` | Brand colors & design tokens; build emits `dist/theme.css` | nothing |
| `@vet-plan/ui` *(planned)* | Cross-platform primitives (Button, Card, Input) | `shared`, `tokens`, `react-native`, `nativewind` |
| `@vet-plan/app` *(planned)* | Screens, features, API client, navigation | `ui`, `shared`, `tokens`, `solito` |
| `packages/config` *(planned)* | Centralized ESLint, Prettier, TS base configs | — |

## 3. $0 Infrastructure Stack Boundary
- Database: Neon Postgres (Free Tier)
- Cache / Rate Limiting: Upstash Redis (Free Tier)
- Backend Compute: GCP Cloud Run (2M free requests/month)
- Frontend Hosting: Cloudflare Pages (Unlimited free bandwidth). Next.js 16 with `cacheComponents` needs a server runtime, so verify the OpenNext adapter on Cloudflare Workers before production.
- AI Triaging: Google AI Studio (Gemini 2.5 Flash Free Tier). Free-tier prompts may be used by Google; strip patient/client identifiers before sending.
- Mobile builds: Expo Go and local builds are free; EAS Build free plan has a monthly build quota.
- **Known non-zero costs (publishing only):** Apple Developer Program $99/year, Google Play $25 one-time.

## 4. Cross-Platform Frontend (Solito 5 + Expo Router + NativeWind)

### 4.1 Layering
```
apps/frontend (Next.js 16)        apps/mobile (Expo Router, SDK 58)
  route files only ──┐               route files only ──┐
                     ▼                                  ▼
               packages/app   ← screens, features, API client, solito navigation
                     ▼
               packages/ui    ← View/Text/Pressable + className (NativeWind)
                     ▼
     packages/tokens   packages/shared   ← no React, platform-neutral
```
Dependencies point **down only**. Apps contain routing, platform setup, and platform-only features. Shared packages never import from apps.

### 4.2 Rules
- **Routing:** URLs are identical on both platforms (`/cases`, `/cases/[id]`). Screens navigate with `solito/navigation` (`useRouter`, `useParams`) and `solito/link`. Never with `next/navigation` or `expo-router` directly.
- **Route files are thin:** `apps/frontend/src/app/(dashboard)/cases/page.tsx` and `apps/mobile/app/cases/index.tsx` only render `CasesListScreen` from `@vet-plan/app`.
- **Styling:** React Native primitives + `className` (NativeWind). Web renders them through `react-native-web`. Brand colors come from `@vet-plan/tokens/theme.css`. Never hardcode hex.
- **Server/Client boundary:** shared screens are client components. Mark the screen entry files `'use client'`. Next.js server components may fetch data and pass it as props.
- **Platform splits:** use `*.web.tsx` / `*.native.tsx` file suffixes inside `packages/ui` when a primitive must differ by platform.
- **Peer dependencies:** `packages/ui` and `packages/app` list `react`, `react-native`, `nativewind`, and `solito` as `peerDependencies` so each app supplies one copy.
- **React version:** Expo SDK 58 ships React Native 0.88 (React ^19.3). Keep `react` and `react-dom` in `apps/frontend` on the same minor as the Expo SDK.

### 4.3 Versions & Decisions (as of 2026-10)
| Tool | Version | Note |
|---|---|---|
| `solito` | 5.0.0 | Web-first; no `react-native-web` requirement inside Solito itself |
| `expo` / `expo-router` | SDK 58 | React Native 0.88 |
| `nativewind` | 5.0.0-rc.0 (pin exact) | v5 runs on Tailwind v4 (same as web). Fallback: 4.2.x stable, which requires Tailwind v3 in `apps/mobile` only |
| `react-native-web` | 0.21.x | Needed by `apps/frontend` to render `packages/ui` |

### 4.4 DICOM Canvas
- The surgical math stays in `@vet-plan/shared` and runs on both platforms.
- The web viewer (`apps/frontend/src/components/canvas`) uses Canvas/WebGL and is web-only.
- A mobile viewer, if needed, uses `@shopify/react-native-skia` in `apps/mobile`. Measurement *state* (points, lines, results) can still live in `packages/app`.
