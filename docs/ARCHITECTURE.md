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
