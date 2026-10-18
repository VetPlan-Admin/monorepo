# VetPlan — System Architecture & Data Standards

## 1. Security & RBAC Standard
- `JwtAuthGuard` and `RolesGuard` are registered globally as `APP_GUARD` providers in `app.module.ts` (JWT authentication first, then role authorization). Do NOT add `@UseGuards(JwtAuthGuard, RolesGuard)` to controllers — it runs the guards twice.
- `RolesGuard` is **deny-by-default**: every endpoint MUST declare either `@Roles(...)` (allowed roles) or `@Public()` (no authentication, e.g. `/health`, OAuth callbacks). A route with neither returns `403 Forbidden`.
- `@Roles(...)` / `@Public()` may be applied at handler or controller level; handler-level metadata overrides controller-level.
- Supported User Roles: `SUPER_ADMIN`, `CLINIC_ADMIN`, `VETERINARIAN`, `ASSISTANT`.
- JWT payload: `{ sub, tenantId, role, typ: 'access' }`. The backend reads it from the `Authorization: Bearer` header. Web keeps the token in an HTTP-only cookie (synced by Next.js); mobile keeps it in `expo-secure-store`.
- Use `@CurrentUser()` to read `{ userId, tenantId, role }` in handlers. Tenant-scoped queries MUST filter by `tenantId` from the token, never from the request body.

### 1.1 Social Login Flow
```
Browser ──GET /auth/oauth/:provider──────────▶ Backend   (OAuthGuard: random `state` → HTTP-only cookie)
Browser ◀──302 provider consent screen───────── Backend
Browser ──GET /auth/oauth/:provider/callback─▶ Backend   (state checked; strategy → UsersService.findOrCreateFromOAuth)
Browser ◀──302 APP_URL/auth/callback?code=…──── Backend   (code = 60-second JWT, typ 'exchange')
Next.js route handler ──POST /auth/exchange──▶ Backend   (server-to-server; returns access token)
Browser ◀──302 / + Set-Cookie vp_session (HttpOnly, SameSite=Lax, Secure in prod)── Next.js
Next.js server components ──GET /auth/me (Bearer from cookie)──▶ Backend
```
- Providers: `google` (`passport-google-oauth20`), `linkedin` (custom OpenID Connect strategy on `passport-oauth2`; the legacy `passport-linkedin-oauth2` API is retired), `facebook` (`passport-facebook`).
- Sign-in resolution: linked provider identity → existing user with the same **verified** email (links the provider) → otherwise a new tenant with the user as `CLINIC_ADMIN`. Unverified emails are rejected.
- A provider without credentials in `.env` is disabled: its button sends users back to `/login?error=provider_unavailable`.
- OAuth routes are browser-facing: errors redirect to `APP_URL/login?error=…` (`OAuthRedirectFilter`) instead of returning JSON.
- The token never reaches client-side JavaScript. The browser only talks to the backend for the OAuth redirects.

### 1.2 Setup Checklist
1. `.env` (root): `JWT_SECRET` (long random string), `API_URL=http://localhost:4000`, `APP_URL=http://localhost:3000`, provider credentials, `DATABASE_URL`.
2. Register these redirect URIs with each provider (swap the host in production):
   - Google Cloud Console → OAuth client → `http://localhost:4000/auth/oauth/google/callback`
   - LinkedIn Developers → app → Products: **Sign In with LinkedIn using OpenID Connect** → `http://localhost:4000/auth/oauth/linkedin/callback`
   - Meta for Developers → Facebook Login → `http://localhost:4000/auth/oauth/facebook/callback`
3. Apply migrations: `pnpm --filter @vet-plan/backend migration:run`.
4. Promote platform staff manually: `UPDATE users SET role = 'SUPER_ADMIN', tenant_id = NULL WHERE email = '…';`

## 2. Shared Workspace Packages
| Package | Contents | May import |
|---|---|---|
| `@vet-plan/shared` | DTOs, Enums (`Role`, `Species`, `ProcedureType`, `OAuthProvider`), surgical math engine (§6) | nothing (no React) |
| `@vet-plan/tokens` | Brand colors & design tokens; build emits `dist/theme.css` | nothing |
| `@vet-plan/ui` | Cross-platform primitives (`Button`) + the web `react-native` shim | `tokens`, `react-native` |
| `@vet-plan/app` | Screens, API client, `ApiProvider`, `NavigationProvider`/`Link` | `ui`, `shared`, `tokens`, `react-native` |
| `packages/config` *(planned)* | Centralized ESLint, Prettier, TS base configs | — |

## 3. $0 Infrastructure Stack Boundary
- Database: Neon Postgres (Free Tier)
- Cache / Rate Limiting: Upstash Redis (Free Tier)
- Backend Compute: GCP Cloud Run (2M free requests/month)
- Frontend Hosting: Cloudflare Pages (Unlimited free bandwidth). Next.js 16 with `cacheComponents` needs a server runtime, so verify the OpenNext adapter on Cloudflare Workers before production.
- AI Triaging: Google AI Studio (Gemini 2.5 Flash Free Tier). Free-tier prompts may be used by Google; strip patient/client identifiers before sending.
- Mobile builds: Expo Go and local builds are free; EAS Build free plan has a monthly build quota.
- **Known non-zero costs (publishing only):** Apple Developer Program $99/year, Google Play $25 one-time.

## 4. Cross-Platform Frontend (Expo Router + NativeWind + Solito-style navigation)

### 4.1 Layering
```
apps/frontend (Next.js 16)                 apps/mobile (Expo SDK 58, Expo Router)
  route files + providers ──┐                route files + providers ──┐
  (next/link → NavigationProvider)           (expo-router Link → NavigationProvider)
                            ▼                                          ▼
                      packages/app   ← screens, API client, ApiProvider, Link
                            ▼
                      packages/ui    ← View/Text/Pressable + className
                            ▼
            packages/tokens   packages/shared   ← no React, platform-neutral
```
Dependencies point **down only**. Apps contain routing, providers, and platform-only features (web: session cookie, login page; later mobile: secure-store auth). Shared packages never import from apps, `next/*`, or `expo-*`.

### 4.2 How className works on each platform
| | Native (Expo) | Web (Next.js) |
|---|---|---|
| Engine | NativeWind v5 (`react-native-css`) compiles `src/global.css` through Metro into style objects | Tailwind v4 (`@tailwindcss/turbopack`) compiles `globals.css` into real CSS |
| `className` on RN components | Handled by NativeWind | `react-native` is aliased to `@vet-plan/ui/react-native-web-shim`, which forwards `className` to react-native-web as a compiled style (`{ $$css: true }`) → DOM class |
| Shared sources scanned via | `@source` in `apps/mobile/src/global.css` | `@source` in `apps/frontend/src/app/globals.css` |
| Cascade | Utilities unlayered (NativeWind recommendation) | `@layer rnw, theme, base;` + unlayered utilities, so Tailwind beats react-native-web's base styles; RNW's SSR styles (`styles-provider.tsx`) sit in the lowest layer |

NativeWind v5 has no Next.js/Turbopack integration yet ("Other Bundlers: coming soon"), hence the shim. When it ships one, the shim can be replaced without touching shared code.

### 4.3 Rules
- **Routing:** URLs are identical on both platforms (`/`, `/cases`). Shared screens navigate only with `Link` from `@vet-plan/app`. Each app injects its router link via `NavigationProvider` (`apps/frontend/src/app/navigation-provider.tsx`, `apps/mobile/src/navigation.tsx`). Add an imperative `useRouter` the same way when a screen needs one.
- **Route files are thin:** `apps/frontend/src/app/(dashboard)/cases/page.tsx` and `apps/mobile/src/app/cases.tsx` only render `CasesScreen` from `@vet-plan/app`.
- **Platform-specific UI** goes in slots/props (e.g. `HomeScreen`'s `session` prop, filled by the web page with the cookie-based session panel) or in `*.native.tsx` overrides inside shared packages (shared file = web version; Metro picks `.native.tsx` first).
- **Styling:** React Native primitives (`View`, `Text`, `Pressable`, …) + `className`. Brand colors via `@vet-plan/tokens`. Never hardcode hex. Avoid DOM elements in shared packages.
- **Server/Client boundary:** shared screens/providers are client components (`'use client'` at the top of each file). Next.js server components may fetch data and pass it as props or slots.
- **Data:** shared screens call the backend through `useApiClient()` (`ApiProvider` in each app's root layout: web passes `API_URL`, mobile `EXPO_PUBLIC_API_URL`). The backend allows CORS only from `APP_URL`.
- **One React, one React Native:** Expo SDK 58 pins React 19.3.0 / React Native 0.88.0. `apps/frontend` and the shared packages' peer ranges MUST match exactly (Expo does not support duplicates). Upgrade Expo first, then align Next's React.
- **Mobile dependencies:** add them with `pnpm --filter @vet-plan/mobile exec expo install <pkg>` so versions match the SDK.

### 4.3.1 Versions & Decisions (as of 2026-10)
| Tool | Version | Note |
|---|---|---|
| `expo` / `expo-router` | SDK 58 | React Native 0.88, React 19.3.0 |
| `nativewind` + `react-native-css` | `5.0.0-rc.0` + `3.1.0-rc.0` (exact pair) | Tailwind `4.1.12` in `apps/mobile`; `lightningcss` pinned to `1.30.1` for the mobile toolchain via scoped `overrides` in `pnpm-workspace.yaml` |
| `react-native-web` | 0.21.x | Renders `packages/ui` / `packages/app` in Next.js |
| `solito` | **not used** | Solito 5.0.0 drives navigation through `@react-navigation/native`; Expo Router 58 replaced it with a vendored fork (no `getActionFromState`), so Solito links can't reach Expo Router's navigator. `NavigationProvider` + `Link` implement the same idea with no router dependency; revisit when Solito supports Expo Router 58. |

### 4.4 DICOM Canvas
- The surgical math stays in `@vet-plan/shared` (§6) and runs on both platforms. The canvas only collects landmark `Point2D`s in image pixels and renders the results.
- The web viewer (`apps/frontend/src/components/canvas`) uses Canvas/WebGL and is web-only.
- A mobile viewer, if needed, uses `@shopify/react-native-skia` in `apps/mobile`. Measurement *state* (points, lines, results) can still live in `packages/app`.

## 5. Data Model & Migrations
| Table | Key columns | Notes |
|---|---|---|
| `tenants` | `id` uuid, `name` | One per clinic |
| `users` | `id`, `email` (unique, lowercased), `display_name`, `avatar_url`, `role` (`user_role` enum), `tenant_id` → `tenants` (RESTRICT), `last_login_at` | `tenant_id` is NULL only for `SUPER_ADMIN` |
| `oauth_accounts` | `id`, `provider` (`oauth_provider` enum), `provider_user_id`, `user_id` → `users` (CASCADE) | Unique `(provider, provider_user_id)`; one user can link several providers |

- `Role` is a Postgres enum mirroring `@vet-plan/shared` (fixed set, so no roles table). Adding a role = shared enum + migration.
- Entities live next to their module (`modules/users/user.entity.ts`). Register each entity in `ENTITIES` and each migration in `MIGRATIONS` in `src/config/database.config.ts` (explicit imports, no globs, so both `dist/` and Vitest load them).
- `synchronize` is always off. Schema changes go through migrations:
  - `pnpm --filter @vet-plan/backend migration:generate src/migrations/<Name>` (diffs entities against `DATABASE_URL`)
  - `pnpm --filter @vet-plan/backend migration:run` / `migration:revert` / `migration:show`
- UUIDs use `gen_random_uuid()` (core Postgres 13+), so Neon needs no extensions.
- **Local database without Docker:** `pnpm --filter @vet-plan/backend db:local` starts PGlite (real Postgres compiled to WASM) on `127.0.0.1:5432`, persisted in `apps/backend/.pglite/`. Use `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres`.
- **Tests:** e2e tests boot the full `AppModule` against a throwaway in-memory PGlite with migrations applied (`test/utils/test-app.ts`). `NODE_ENV=test` makes `ConfigModule` ignore `.env`, so tests never touch Neon or real credentials.

## 6. Surgical Math Engine
Full reference: `docs/SURGICAL_MATH.md`.
- Lives in `packages/shared/src/math/` (`geometry`, `calibration`, `tplo`, `tta`, `norberg`). It is pure TypeScript with no React, DOM, or Node APIs, so the backend, web, and mobile all run identical code.
- Inputs are landmark points in **image pixels**, in any orientation. Outputs are degrees and millimetres (via `Calibration`). Results don't depend on image rotation or mirroring (left/right limb).
- Invalid landmarks throw `RangeError` with a human-readable message. Callers must surface it, never substitute a default.
- Clinical defaults are exported constants and overridable parameters: `DEFAULT_TPLO_TARGET_PLATEAU_ANGLE` (5°), `DEFAULT_TTA_TARGET_TENDON_ANGLE` (90°), `DEFAULT_TTA_CAGE_SIZES_MM` (3–15 mm), `NORBERG_NORMAL_THRESHOLD_DEGREES` (105°).
- Coverage is enforced at 100% (`packages/shared/vitest.config.ts`). A formula change requires matching tests and an update to `docs/SURGICAL_MATH.md`.
