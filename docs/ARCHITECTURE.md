# VetPlan — System Architecture & Data Standards

## 1. Security & RBAC Standard
- `JwtAuthGuard` and `RolesGuard` are registered globally as `APP_GUARD` providers in `app.module.ts` (JWT authentication first, then role authorization). Do NOT add `@UseGuards(JwtAuthGuard, RolesGuard)` to controllers — it runs the guards twice.
- `RolesGuard` is **deny-by-default**: every endpoint MUST declare either `@Roles(...)` (allowed roles) or `@Public()` (no authentication, e.g. `/health`, OAuth callbacks). A route with neither returns `403 Forbidden`.
- `@Roles(...)` / `@Public()` may be applied at handler or controller level; handler-level metadata overrides controller-level.
- Supported User Roles: `SUPER_ADMIN`, `CLINIC_ADMIN`, `VETERINARIAN`, `ASSISTANT`. Role groups in `@vet-plan/shared`: `CLINICAL_ROLES` (assistant, vet, clinic admin) and `PLANNING_ROLES` (vet, clinic admin). `SUPER_ADMIN` is platform staff and sees no clinical data.
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

### 1.3 Permissions Matrix (clinical API)
| Action | Assistant | Veterinarian | Clinic admin | Super admin |
|---|---|---|---|---|
| List/read patients and cases, download reports | ✓ | ✓ | ✓ | — |
| Create/update patients | ✓ | ✓ | ✓ | — |
| Create/update cases (incl. status), save/delete plans | — | ✓ | ✓ | — |
| Delete patients (only without cases) and cases | — | — | ✓ | — |

Every query is scoped by the caller's `tenantId` (`requireTenantId`); records of other clinics answer **404**, never 403, so their existence isn't revealed.

## 2. Shared Workspace Packages
| Package | Contents | May import |
|---|---|---|
| `@vet-plan/shared` | Zod request schemas + response DTO types, enums (`Role`, `Species`, `ProcedureType`, `CaseStatus` + transitions, `Limb`, `PatientSex`, `OAuthProvider`), surgical math engine + measurement protocols (§6) | `zod` only (no React) |
| `@vet-plan/tokens` | Brand colors & design tokens; build emits `dist/theme.css` | nothing |
| `@vet-plan/ui` | Cross-platform primitives (`Button`, `Badge`, `TextField`, `ChoiceChips`) + the web `react-native` shim | `tokens`, `react-native` |
| `@vet-plan/app` | Screens (home, cases list/new/detail), typed API client, `useApiQuery`, `ApiProvider`, `NavigationProvider`/`Link`/`useNavigate` | `ui`, `shared`, `tokens`, `react-native` |
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
- **Data:** shared screens call the backend through `useApiClient()` / `useApiQuery()` (`ApiProvider` in each app's root layout). Web passes `/api/backend`, a same-origin proxy that adds the session token server-side (§8.3); mobile passes `EXPO_PUBLIC_API_URL` and (once mobile sign-in exists) a `getAccessToken` reading `expo-secure-store`. The backend still allows CORS from `APP_URL` for direct browser clients.
- **Forms:** validate with the same Zod schemas the API uses (`createCaseSchema`, `createPatientSchema`, …) and map API 400 `errors[]` back onto fields.
- **One React, one React Native:** Expo SDK 58 pins React 19.3.0 / React Native 0.88.0. `apps/frontend` and the shared packages' peer ranges MUST match exactly (Expo does not support duplicates). Upgrade Expo first, then align Next's React.
- **Mobile dependencies:** add them with `pnpm --filter @vet-plan/mobile exec expo install <pkg>` so versions match the SDK.

### 4.3.1 Versions & Decisions (as of 2026-10)
| Tool | Version | Note |
|---|---|---|
| `expo` / `expo-router` | SDK 58 | React Native 0.88, React 19.3.0 |
| `nativewind` + `react-native-css` | `5.0.0-rc.0` + `3.1.0-rc.0` (exact pair) | Tailwind `4.1.12` in `apps/mobile`; `lightningcss` pinned to `1.30.1` for the mobile toolchain via scoped `overrides` in `pnpm-workspace.yaml` |
| `react-native-web` | 0.21.x | Renders `packages/ui` / `packages/app` in Next.js |
| `solito` | **not used** | Solito 5.0.0 drives navigation through `@react-navigation/native`; Expo Router 58 replaced it with a vendored fork (no `getActionFromState`), so Solito links can't reach Expo Router's navigator. `NavigationProvider` + `Link` implement the same idea with no router dependency; revisit when Solito supports Expo Router 58. |

### 4.4 Radiograph Canvas
- The web planner (§7) is web-only (`apps/frontend/src/components/canvas`, HTML canvas).
- All clinical logic lives in `@vet-plan/shared` (math + measurement protocols, §6), so a mobile viewer (`@shopify/react-native-skia` in `apps/mobile`) would only reimplement image loading, drawing and gestures.

## 5. Data Model & Migrations
| Table | Key columns | Notes |
|---|---|---|
| `tenants` | `id` uuid, `name` | One per clinic |
| `users` | `id`, `email` (unique, lowercased), `display_name`, `avatar_url`, `role` (`user_role` enum), `tenant_id` → `tenants` (RESTRICT), `last_login_at` | `tenant_id` is NULL only for `SUPER_ADMIN` |
| `oauth_accounts` | `id`, `provider` (`oauth_provider` enum), `provider_user_id`, `user_id` → `users` (CASCADE) | Unique `(provider, provider_user_id)`; one user can link several providers |
| `patients` | `id`, `tenant_id` → `tenants` (RESTRICT), `name`, `species` (enum), `breed`, `sex` (enum), `date_of_birth`, `weight_kg`, `owner_name`, `external_id` | `external_id` = the clinic's own record number |
| `surgical_cases` | `id`, `tenant_id` (RESTRICT), `patient_id` → `patients` (RESTRICT), `procedure_type` (enum), `limb` (enum), `status` (`case_status` enum, default `PLANNING`), `surgery_date`, `notes`, `created_by_id` → `users` (SET NULL) | Index `(tenant_id, status)` |
| `radiograph_plans` | `id`, `case_id` → `surgical_cases` (CASCADE), `label`, `image_width`, `image_height`, `image_spacing` jsonb, `calibration` jsonb, `measurements` jsonb, `results` jsonb, `created_by_id` (SET NULL) | Landmarks only; `results` is the server's snapshot at save time |

- `Role` is a Postgres enum mirroring `@vet-plan/shared` (fixed set, so no roles table). Adding a role = shared enum + migration. The same goes for `species`, `procedure_type`, `limb`, `case_status` and `patient_sex`.
- **Radiographs are not stored** (decision, Phase 5): no image storage cost ($0 boundary) and patient images stay on the clinic's machine. A plan keeps the image's pixel size and declared spacing so it can be re-attached to the same file in the planner. Revisit if clinics need cross-device image access (would need object storage + a privacy review).
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
- **Measurement protocols** (`packages/shared/src/measurements/`) describe each measurement: ordered landmarks with prompts, parameters with ranges, construction lines, and a `compute` built on the math. `evaluateMeasurement(type, points, parameters, calibration)` returns `incomplete` (next landmark + partial overlay), `complete` (values, warnings, overlay shapes, optional calibration) or `invalid` (message). UIs render protocols generically; adding a measurement means adding a definition, not UI code.
- Coverage is enforced at 100% for `math/` and `measurements/` (`packages/shared/vitest.config.ts`). A formula change requires matching tests and an update to `docs/SURGICAL_MATH.md`.

## 7. Radiograph Planner (web)
Route `/planner` (`apps/frontend/src/app/(dashboard)/planner/page.tsx`) → `RadiographPlanner` (client component).

```
File ──loadRadiograph──▶ RadiographImage ──renderWindowed──▶ offscreen canvas ──viewport──▶ <canvas>
       (DICOM: dicom-parser + jpeg-lossless-decoder-js;      (Float32 modality values,        ▲
        PNG/JPEG/WebP and JPEG-baseline DICOM: browser)        window/level, MONOCHROME1)     │ overlay shapes
plannerReducer (pure) ──points/parameters──▶ evaluateMeasurement (@vet-plan/shared) ──────────┘ + results panel
```
- **Privacy:** files are read with `File.arrayBuffer()` and never uploaded. Persisting anything is a Phase 5 decision.
- **Formats:** DICOM Part 10, first frame, single channel: uncompressed implicit/explicit VR little endian (8/16-bit, signed or unsigned, BitsStored masking), JPEG Lossless (`1.2.840.10008.1.2.4.57`, `.70`), JPEG Baseline (`.50`, decoded by the browser). Other transfer syntaxes and colour DICOM fail with an actionable `ImageLoadError` message. PNG/JPEG/WebP are converted to luminance.
- **Calibration priority** (`resolveCalibration`): latest complete calibration measurement (marker ball / known length) → DICOM `PixelSpacing` → `ImagerPixelSpacing` (with a magnification warning) → none (angles only; mm values withheld with a warning).
- **Coordinates:** landmarks are stored in image pixels; `viewport.ts` maps image ↔ screen (`screen = image × scale + offset`). Overlays are drawn in screen space so stroke widths stay constant at any zoom.
- **Interaction:** click places the next landmark; press-and-drag moves a handle (a click without movement still places a point); drag pans; wheel zooms at the cursor; right-drag adjusts window/level; Backspace undoes; F fits; +/− zoom. Pointer events, so mouse, pen and single-finger touch work.
- **Rendering:** strokes are drawn twice (dark outline under brand-yellow/white), labels on brand-purple tags, inactive measurements at 55% opacity.
- **Testing:** pure modules (`image/dicom.ts`, `image/windowing.ts`, `viewport.ts`, `planner-state.ts`) have Vitest specs (`pnpm --filter @vet-plan/frontend test`), including a real JPEG Lossless sample in `__fixtures__/`. React/canvas code is verified in a real browser.
- **Access:** `src/proxy.ts` redirects `/planner` and `/cases` to `/login` without a `vp_session` cookie (optimistic UX check; the backend validates tokens on every API call).
- **Case link:** `/planner?case=<id>` shows a Case panel that saves the current measurements as a plan (`POST`/`PUT /cases/:id/plans`); `&plan=<id>` offers "Load saved landmarks" once a radiograph of the same pixel size is open. Dragged landmarks are clamped to the image (the API rejects points outside it).

## 8. Cases API & Flows
### 8.1 Endpoints (all JSON; permissions in §1.3)
| Method & path | Purpose |
|---|---|
| `GET /patients?search&species&page&pageSize` | Paginated patients (search: name, owner, record number) |
| `POST /patients`, `GET/PATCH/DELETE /patients/:id` | Patient CRUD (`DELETE` → 409 while the patient has cases) |
| `GET /cases?search&status&procedureType&patientId&page&pageSize` | Paginated case summaries with patient + `planCount` |
| `POST /cases`, `GET/PATCH/DELETE /cases/:id` | Case CRUD; `PATCH` also changes `status` |
| `POST /cases/:id/plans`, `PUT/DELETE /cases/:id/plans/:planId` | Save, replace, delete radiograph plans |
| `GET /cases/:id/report` | `SurgicalPlanReportDto` JSON, `Content-Disposition: attachment` |

### 8.2 Rules
- **Validation:** bodies and queries are parsed by `ZodValidationPipe` with schemas from `@vet-plan/shared` (unknown keys are stripped). 400 responses carry `{ message, errors: [{ path, message }] }`.
- **Status workflow:** `CASE_STATUS_TRANSITIONS` (PLANNING ↔ PLANNED → COMPLETED; PLANNING/PLANNED → CANCELLED → PLANNING). Invalid transitions → 409. Procedure, limb and surgery date are editable only while PLANNING/PLANNED; notes always.
- **Plans:** only while the case is PLANNING/PLANNED (else 409). The API accepts landmarks (`type`, `points`, `parameters`), image size and declared spacing, rejects points outside the image, and recomputes `calibration` + `results` with `computePlanResults`. Client-supplied values are never stored. Results are a snapshot; saving the plan again recomputes them with the current engine.
- **Report:** built from stored plans (what was planned), with formatted values, landmarks, parameters, clinic, patient, author and a decision-support disclaimer. Format id `vet-plan.surgical-plan-report`, version 1.

### 8.3 Web proxy (`/api/backend/*`)
- `src/app/api/backend/[...path]/route.ts` → `proxyToBackend` (`src/lib/backend-proxy.ts`): forwards to `API_URL` with `Authorization: Bearer <vp_session>`; the token never reaches client JavaScript.
- Only `health`, `auth/me`, `patients/**` and `cases/**` are forwarded (others → 404). Writes require `Origin` = the app's own origin (CSRF defence on top of `SameSite=Lax`). Only `Content-Type` and `Content-Disposition` are passed back; responses are `no-store`.
