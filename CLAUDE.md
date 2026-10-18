# Vet Plan — Monorepo AI Agent Guidelines

## 1. Project Overview & Architecture
- **Product:** Vet Plan — Multi-tenant SaaS for veterinary orthopedic surgical planning.
- **Cost Target:** $0/month operational costs utilizing free tiers (Neon Postgres, Upstash Redis, Grafana Cloud, Axiom, Gemini 2.5 Flash Free Tier).
- **Structure:** `pnpm` monorepo containing:
  - `apps/frontend` (`@vet-plan/frontend`): Next.js 16 App Router + React 19, Tailwind CSS v4, Lucide Icons, `next-intl`. Read `apps/frontend/AGENTS.md` before writing Next.js code.
  - `apps/mobile` (`@vet-plan/mobile`): Expo SDK 58 + Expo Router + NativeWind v5 (RC). Read `apps/mobile/AGENTS.md` before writing Expo code.
  - `apps/backend` (`@vet-plan/backend`): NestJS ESM service, TypeORM, Passport.js, OpenTelemetry.
  - `packages/*`: Shared modules, design tokens, and cross-platform UI.
- **Cross-Platform Strategy:** Expo Router + NativeWind on mobile, react-native-web in Next.js, Solito-style navigation (`NavigationProvider` + `Link` in `@vet-plan/app`; the `solito` package itself is incompatible with Expo Router 58). Web and mobile share screens and UI from `packages/app` and `packages/ui`. See `docs/ARCHITECTURE.md` §4.

## 2. Branding & UI Design System
- **Dark Purple:** `#3B0764` (Primary background/accents)
- **Light Yellow:** `#FEF08A` (Primary CTA/high-contrast text)
- **Single source of truth:** `packages/tokens/src/index.ts`. Its build emits `dist/theme.css` (a Tailwind v4 `@theme` block) imported by `apps/frontend/src/app/globals.css` and `apps/mobile/src/global.css`.
- Use the Tailwind classes `bg-brand-purple`, `text-brand-yellow`, etc. Use `colors.brand.*` from `@vet-plan/tokens` where classes don't apply (canvas overlays, native APIs). NEVER hardcode the hex values.
- **Monogram Assets:** VP Monogram, V Angle Icons, Centered Text Logo.

## 3. Package Management & Commands
- **PackageManager:** `pnpm@11` (or local corepack equivalent).
- **Build All:** `pnpm build`
- **Dev Mode:** `pnpm dev` (or a single app: `pnpm --filter @vet-plan/frontend dev`, `pnpm --filter @vet-plan/mobile dev` → scan the QR code with Expo Go)
- **Typecheck All:** `pnpm typecheck` (`pnpm lint` also type-checks mobile and the shared UI packages)
- **Lint All:** `pnpm lint`
- **Test All:** `pnpm test` (backend e2e: `pnpm --filter @vet-plan/backend test:e2e`; surgical math with coverage: `pnpm --filter @vet-plan/shared test`; planner modules: `pnpm --filter @vet-plan/frontend test`)
- **Database Migrations:** `pnpm --filter @vet-plan/backend migration:run` (also `migration:generate src/migrations/<Name>`, `migration:revert`, `migration:show`). Register new migrations in `src/config/database.config.ts`.
- **Local Postgres (no Docker):** `pnpm --filter @vet-plan/backend db:local` (PGlite on `127.0.0.1:5432`)
- **Ports:** frontend `3000`, backend `4000` (`APP_URL` / `API_URL` in `.env`), Expo dev server `8081`
- **Mobile dependencies:** `pnpm --filter @vet-plan/mobile exec expo install <pkg>` (SDK-compatible versions)

## 4. Coding Standards & Governance
- **TypeScript:** Strict mode enabled. No `any` casts without explicit justification.
- **ESM Imports:** `apps/backend`, `packages/shared`, and `packages/tokens` compile with `nodenext`. Relative imports MUST end in `.js` (`./cases.module.js`). Package imports NEVER get an extension (`@vet-plan/shared`, not `@vet-plan/shared.js`). Next.js and Expo code uses bundler resolution and needs no extensions.
- **Backend Auth:** Social login via Passport (Google, LinkedIn OIDC, Facebook) + JWT. `JwtAuthGuard` and `RolesGuard` are global and deny by default: every route MUST declare `@Roles(...)` or `@Public()`. Do NOT add `@UseGuards(JwtAuthGuard, RolesGuard)` to controllers. Read the caller with `@CurrentUser()` and scope tenant data by its `tenantId`. Flow: `docs/ARCHITECTURE.md` §1.1.
- **Frontend Auth:** the access token lives only in the HTTP-only `vp_session` cookie. Read the user with `getCurrentUser()` from `src/lib/session.ts` inside a `<Suspense>` boundary (Cache Components). Never expose the token to client components.
- **Surgical Math:** all clinical measurements live in `packages/shared/src/math/` and nowhere else (no angle maths in components or services). Inputs are image-pixel `Point2D` landmarks, outputs degrees/mm; invalid input throws `RangeError`. Coverage MUST stay at 100%, and formula or default changes MUST update `docs/SURGICAL_MATH.md`.
- **Measurements in UIs:** canvases and screens call `evaluateMeasurement` from `@vet-plan/shared` and render its overlay/values; they never compute clinical values themselves. A new measurement = a protocol definition in `packages/shared/src/measurements/definitions.ts` + tests + a row in `docs/SURGICAL_MATH.md` §3.
- **Radiograph Privacy:** the planner reads files in the browser and uploads nothing. Any feature that sends images or patient metadata to the backend needs an explicit decision recorded in `docs/ARCHITECTURE.md`.
- **Cross-Platform Code:** `packages/ui` and `packages/app` MUST NOT import from `next/*`, `expo-*`, or app folders. Write React Native primitives (`View`, `Text`, `Pressable`) with `className`; navigate with `Link` from `@vet-plan/app`; call the backend with `useApiClient()`. Shared files must start with `'use client'`. Exactly one React (19.3.0) and React Native (0.88.0) version in the repo. Rules in `docs/ARCHITECTURE.md` §4.
- **Telemetry:** Expose OpenTelemetry metrics via `/metrics` on NestJS; do NOT introduce proprietary paid SaaS SDKs.
- **Git Commit Style:** Conventional Commits (`feat(...)`, `fix(...)`, `chore(...)`).

## 5. Security Restrictions
- NEVER commit secrets or `.env` files. Document new keys in `.env.example`.
- ALWAYS maintain strict `.gitignore` rules for `node_modules`, `.pnpm-store`, build outputs, and `.env`.

## 6. Monorepo Directory Structure & File Blueprint
Folders marked *(planned)* don't exist yet.

vetplan-monorepo/
├── apps/
│   ├── frontend/                   # Next.js 16 App Router (web)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)/         # Login layout (brand purple)
│   │   │   │   │   ├── layout.tsx
│   │   │   │   │   └── login/page.tsx   # Social login buttons → backend /auth/oauth/:provider
│   │   │   │   ├── auth/
│   │   │   │   │   ├── callback/route.ts # Exchanges code → sets HTTP-only vp_session cookie
│   │   │   │   │   └── logout/route.ts   # POST: clears the cookie
│   │   │   │   ├── (dashboard)/    # Main Surgical Planning Workspace (session required, see proxy.ts)
│   │   │   │   │   ├── cases/page.tsx   # Thin route → CasesScreen from @vet-plan/app
│   │   │   │   │   └── planner/page.tsx # Radiograph planner (web-only)
│   │   │   │   ├── globals.css     # Tailwind layers + tokens + @source for shared packages
│   │   │   │   ├── layout.tsx      # StylesProvider, ApiProvider, WebNavigationProvider
│   │   │   │   ├── navigation-provider.tsx  # Injects next/link into @vet-plan/app's Link
│   │   │   │   ├── styles-provider.tsx      # SSR react-native-web styles (lowest CSS layer)
│   │   │   │   └── page.tsx        # HomeScreen from @vet-plan/app + web session panel
│   │   │   ├── components/
│   │   │   │   └── canvas/         # Radiograph planner (web-only, ARCHITECTURE §7)
│   │   │   │       ├── image/      # DICOM/raster loading, windowing (+ *.test.ts)
│   │   │   │       ├── planner-state.ts     # Pure reducer, calibration resolution
│   │   │   │       ├── viewport.ts          # image ↔ screen transforms
│   │   │   │       ├── overlay-renderer.ts  # High-contrast drawing of protocol overlays
│   │   │   │       ├── planner-canvas.tsx   # Canvas + pointer/keyboard interaction
│   │   │   │       ├── radiograph-planner.tsx, measurement-card.tsx
│   │   │   │       └── __fixtures__/        # DICOM writer + real JPEG Lossless sample
│   │   │   ├── lib/
│   │   │   │   ├── api.ts          # Server-only backend URL
│   │   │   │   ├── session.ts      # getCurrentUser() ('use cache: private')
│   │   │   │   └── session-cookie.ts  # Cookie name shared with proxy.ts
│   │   │   ├── proxy.ts            # Redirects /planner, /cases to /login without a session
│   │   │   └── types/              # Ambient declarations (jpeg-lossless-decoder-js)
│   │   ├── public/                 # Monogram Logos & Static Assets
│   │   ├── next.config.ts          # react-native → @vet-plan/ui shim alias, transpilePackages
│   │   └── package.json
│   │
│   ├── mobile/                     # Expo SDK 58 + Expo Router + NativeWind v5
│   │   ├── src/
│   │   │   ├── app/                # Expo Router routes: _layout.tsx (providers), index.tsx, cases.tsx
│   │   │   ├── global.css          # NativeWind + tokens + @source for shared packages
│   │   │   └── navigation.tsx      # Injects expo-router Link into @vet-plan/app's Link
│   │   ├── app.json                # Expo config (name, scheme `vetplan`, brand splash)
│   │   ├── metro.config.js         # withNativewind(getDefaultConfig())
│   │   ├── postcss.config.mjs
│   │   └── AGENTS.md               # Expo's agent rules + Vet Plan specifics
│   │
│   └── backend/                    # NestJS REST API & Microservices
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/           # Controller, AuthService, strategies (jwt, google, linkedin, facebook),
│       │   │   │                   # guards (global JWT + Roles, OAuthGuard), decorators, filters
│       │   │   ├── users/          # User & OAuthAccount entities, UsersService (sign-in resolution)
│       │   │   ├── tenants/        # Tenant entity (clinic)
│       │   │   ├── cases/          # Orthopedic Surgical Cases & Measurements
│       │   │   ├── ai-bot/         # (planned) Gemini 2.5 Flash Triage & Telegram Webhook
│       │   │   └── telemetry/      # (planned) OpenTelemetry & Prometheus /metrics
│       │   ├── config/             # database.config.ts (entities, migrations) + data-source.ts (CLI)
│       │   ├── migrations/         # TypeORM migrations (registered in database.config.ts)
│       │   ├── app.module.ts
│       │   ├── app.setup.ts        # Middleware shared by main.ts and e2e tests
│       │   ├── tracing.ts          # (planned) OpenTelemetry Exporter Initialization
│       │   └── main.ts
│       ├── test/                   # e2e specs + utils/test-app.ts (PGlite-backed AppModule)
│       └── package.json
│
├── packages/                       # Shared Internal Workspace Packages
│   ├── shared/                     # DTOs, Enums (Role…), surgical math engine. No React.
│   │   └── src/
│   │       ├── math/               # geometry, calibration, tplo, tta, norberg (+ specs, __fixtures__)
│   │       └── measurements/       # Protocols: landmarks, parameters, evaluateMeasurement
│   ├── tokens/                     # Design tokens (TS + generated Tailwind theme.css)
│   ├── ui/                         # Cross-platform primitives (Button) + web react-native shim
│   ├── app/                        # Cross-platform screens, API client, ApiProvider, Link
│   └── config/                     # (planned) Shared ESLint, TS, Prettier Configs
│
├── docs/                           # ROADMAP.md, ARCHITECTURE.md, SURGICAL_MATH.md
├── .env.example                    # Required environment keys (no values)
├── .gitignore                      # Strict Git exclusions
├── CLAUDE.md                       # AI Agent Guidelines & Architecture Specs
├── GEMINI.md                       # Symlink -> CLAUDE.md
├── package.json                    # Root package manager & workspace scripts
├── pnpm-workspace.yaml             # Monorepo packages & build rules
└── turbo.json                      # Turborepo task pipeline execution

## 7. Operational Documentation
Refer to the following guides for execution steps and architecture details:
- `docs/ROADMAP.md` — Phase-by-phase implementation checklist. Start here for "what's next".
- `docs/ARCHITECTURE.md` — System design, security rules, cross-platform layering, and data model.
- `docs/SURGICAL_MATH.md` — Definitions, landmarks, model assumptions, and references for every clinical measurement.
- `apps/mobile/README.md`, `packages/ui/README.md`, `packages/app/README.md` — How to run, extend, and test each cross-platform package.
