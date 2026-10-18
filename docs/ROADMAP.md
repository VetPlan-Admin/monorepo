# VetPlan — Implementation Roadmap & Execution Checklist

## Phase 0: Monorepo Foundation
- [x] pnpm 11 + Turborepo workspace with `@vet-plan/frontend`, `@vet-plan/backend`, `@vet-plan/shared`.
- [x] Strict `.gitignore`, `.env.example`, clean Git history (no `node_modules` / `.env`).
- [x] `@vet-plan/tokens`: brand colors as TS + generated Tailwind v4 `theme.css`, wired into `apps/frontend`.
- [ ] `packages/config`: shared TS base config (`tsconfig.base.json`), Prettier, ESLint presets.

## Phase 1: Authentication, Multi-Tenancy & RBAC
- [x] Implement `Tenant`, `User`, and `OAuthAccount` entities in `@vet-plan/backend` (`Role` is a Postgres enum, see ARCHITECTURE §5).
- [x] Add TypeORM data source (`src/config/`), initial migration, and `migration:*` scripts.
- [x] Configure Passport OAuth2 strategies (Google, LinkedIn OpenID Connect, Facebook) + JWT issuing.
- [x] Create `@Roles()` decorator and `RolesGuard` for controller authorization (global, deny-by-default).
- [x] JWT strategy (`Authorization: Bearer`) with `{ sub, tenantId, role, typ }` payload.
- [x] Build Next.js auth layout (`/app/(auth)/login/page.tsx`) and HTTP-only cookie session sync.
- [ ] **Your setup:** register OAuth apps and callback URLs, set `JWT_SECRET`, run `migration:run` on Neon (ARCHITECTURE §1.2).
- [ ] Clinic invitations: let a `CLINIC_ADMIN` add `VETERINARIAN` / `ASSISTANT` users to their tenant (today every new sign-up creates its own clinic).
- [ ] Refresh tokens or sliding sessions (access tokens currently last `JWT_EXPIRES_IN`, default 24h).
- [ ] Make exchange codes single-use (store the code id in Upstash Redis); today they expire after 60s.

## Phase 2: Cross-Platform Frontend Foundation
- [x] **2.1 `packages/ui`:** `Button` (primary/outline, brand colors) + web `react-native` shim that forwards `className`.
- [x] **2.2 Web wiring:** `react-native-web` in `apps/frontend`, `react-native` alias + `transpilePackages`, Tailwind layers/`@source`, SSR styles provider.
- [x] **2.3 `packages/app`:** `HomeScreen` (API health badge, `Button`, link to `/cases`), `CasesScreen`, typed API client + `ApiProvider`, `NavigationProvider`/`Link`.
- [x] **2.4 `apps/mobile`:** Expo SDK 58 + Expo Router, NativeWind v5 RC with `@vet-plan/tokens/theme.css`, routes `/` and `/cases` rendering the shared screens.
- [x] **2.5 Verify parity:** web renders the shared screens (SSR + browser, health check over CORS); Android/iOS bundles compile the same classes to native styles (`expo export`).
- [x] **2.6 Docs:** CLAUDE.md, ARCHITECTURE §4, package READMEs.
- [ ] **On-device check:** `pnpm --filter @vet-plan/mobile dev`, open in Expo Go, confirm both screens and navigation (needs a phone; not verifiable in CI).
- [ ] Mobile sign-in: `expo-auth-session` → backend OAuth → exchange code → `expo-secure-store`; inject the token into `createApiClient({ getAccessToken })`.
- [ ] Replace Expo template icons/splash with the VP monogram.
- [ ] Re-evaluate when NativeWind v5 goes stable (and ships a Next.js integration) or Solito supports Expo Router 58.

## Phase 3: Surgical Math Engine (`packages/shared`)
Reference: `docs/SURGICAL_MATH.md`.
- [x] Geometry core: orientation-independent angles, least-squares circle fit, pixel↔mm calibration (marker ball or known length).
- [x] TPLO: `tibialPlateauAngle` (TPA), `mechanicalMedialProximalTibialAngle` (mMPTA), `tploRotationPlan` (rotation, chord, arc for a saw blade radius).
- [x] TTA: `patellarTendonAngle`, `ttaAdvancement` (conventional linear model), `selectTtaCageSize`, `ttaAdvancementMatrix` (predicted PTA per cage).
- [x] Norberg: `norbergAngle`, `bilateralNorbergAngles`, `isNorbergAngleWithinNormalLimits` (105° default).
- [x] Vitest with enforced 100% coverage; every case re-tested under rotation/translation/scale/mirroring (57 tests).
- [ ] Clinical validation: compare outputs with measurements by the surgical team on real radiographs.
- [ ] Hinged TTA model (Modified Maquet / TTA Rapid): cage width at the cage level from the hinge position.
- [ ] TPLO off-centre osteotomy: predict the achieved TPA when the cut isn't centred on the eminences.

## Phase 4: Web-Based DICOM Canvas & Overlay Engine
- [ ] Build interactive DICOM image viewer component in `apps/frontend` (web-only, see ARCHITECTURE §4.4).
- [ ] Implement high-contrast canvas drawing tools for point selection and line vectors.
- [ ] Bind the `@vet-plan/shared` math (TPA, mMPTA, PTA/TTA, Norberg, calibration) to real-time canvas overlays (`colors.brand.yellow` from `@vet-plan/tokens`). Show `RangeError` messages instead of numbers for invalid landmarks.
- [ ] *(Optional)* Mobile viewer with `@shopify/react-native-skia` sharing measurement state from `packages/app`.

## Phase 5: Surgical Case Management & Workflows
- [ ] Build Patient & Surgical Case REST endpoints with RBAC protection (`@Roles` on every handler; DTOs in `@vet-plan/shared`).
- [ ] Create case history screens in `packages/app` (search, filter, procedure status badges), routed on web and mobile.
- [ ] Add JSON metadata export for surgical planning reports.

## Phase 6: AI Support Bot & Observability
- [ ] Build Telegram webhook handler in NestJS using Google AI Studio free Gemini API key.
- [ ] Integrate `@octokit/rest` for automated GitHub Issue creation on reported bugs.
- [ ] Expose `/metrics` endpoint with OpenTelemetry for Grafana Cloud & Axiom log streaming.
