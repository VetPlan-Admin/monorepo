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

## Phase 2: Cross-Platform Frontend Foundation (Solito 5)
Follow the READMEs in order. Each step should end with `pnpm build && pnpm lint` passing.
- [ ] **2.1 `packages/ui`:** create the package (`packages/ui/README.md`), first primitive `Button` in brand colors.
- [ ] **2.2 Web wiring:** add `react-native-web`, `nativewind`, `solito` to `apps/frontend`; configure `transpilePackages` + `react-native` alias in `next.config.ts`; render `Button` on the home page.
- [ ] **2.3 `packages/app`:** create the package (`packages/app/README.md`), `HomeScreen` using `solito/link`, typed API client calling `GET /health`.
- [ ] **2.4 `apps/mobile`:** bootstrap Expo SDK 58 (`apps/mobile/README.md`), NativeWind with `@vet-plan/tokens/theme.css`, route `/` rendering `HomeScreen`.
- [ ] **2.5 Verify parity:** the same `HomeScreen` renders on web (`pnpm --filter @vet-plan/frontend dev`) and in Expo Go (`pnpm --filter @vet-plan/mobile dev`).
- [ ] **2.6 Docs:** remove *(planned)* markers in `CLAUDE.md` and `docs/ARCHITECTURE.md`; replace the bootstrap READMEs with usage docs.

## Phase 3: Surgical Math Engine (`packages/shared`)
- [ ] Create pure mathematical functions for TPLO angle calculation (MPTA, TPA).
- [ ] Implement TTA cage size & advancement matrix algorithms.
- [ ] Implement Norberg Angle calculation for canine hip dysplasia.
- [ ] Write 100% test coverage with Vitest for edge cases and precision tolerances.

## Phase 4: Web-Based DICOM Canvas & Overlay Engine
- [ ] Build interactive DICOM image viewer component in `apps/frontend` (web-only, see ARCHITECTURE §4.4).
- [ ] Implement high-contrast canvas drawing tools for point selection and line vectors.
- [ ] Bind frontend surgical math calculations to real-time canvas overlays (`colors.brand.yellow` from `@vet-plan/tokens`).
- [ ] *(Optional)* Mobile viewer with `@shopify/react-native-skia` sharing measurement state from `packages/app`.

## Phase 5: Surgical Case Management & Workflows
- [ ] Build Patient & Surgical Case REST endpoints with RBAC protection (`@Roles` on every handler; DTOs in `@vet-plan/shared`).
- [ ] Create case history screens in `packages/app` (search, filter, procedure status badges), routed on web and mobile.
- [ ] Add JSON metadata export for surgical planning reports.

## Phase 6: AI Support Bot & Observability
- [ ] Build Telegram webhook handler in NestJS using Google AI Studio free Gemini API key.
- [ ] Integrate `@octokit/rest` for automated GitHub Issue creation on reported bugs.
- [ ] Expose `/metrics` endpoint with OpenTelemetry for Grafana Cloud & Axiom log streaming.
