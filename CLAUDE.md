# Vet Plan — Monorepo AI Agent Guidelines

## 1. Project Overview & Architecture
- **Product:** Vet Plan — Multi-tenant SaaS for veterinary orthopedic surgical planning.
- **Cost Target:** $0/month operational costs utilizing free tiers (Neon Postgres, Upstash Redis, Grafana Cloud, Axiom, Gemini 2.5 Flash Free Tier).
- **Structure:** `pnpm` monorepo containing:
  - `apps/frontend` (`@vet-plan/frontend`): Next.js 16 App Router + React 19, Tailwind CSS v4, Lucide Icons, `next-intl`. Read `apps/frontend/AGENTS.md` before writing Next.js code.
  - `apps/mobile` (`@vet-plan/mobile`, **planned**): Expo SDK 58 + Expo Router + NativeWind. Bootstrap steps in `apps/mobile/README.md`.
  - `apps/backend` (`@vet-plan/backend`): NestJS ESM service, TypeORM, Passport.js, OpenTelemetry.
  - `packages/*`: Shared modules, design tokens, and cross-platform UI.
- **Cross-Platform Strategy:** Solito 5 + Expo Router + NativeWind. Web (Next.js) and mobile (Expo) share screens and UI components from `packages/app` and `packages/ui`. See `docs/ARCHITECTURE.md` §4.

## 2. Branding & UI Design System
- **Dark Purple:** `#3B0764` (Primary background/accents)
- **Light Yellow:** `#FEF08A` (Primary CTA/high-contrast text)
- **Single source of truth:** `packages/tokens/src/index.ts`. Its build emits `dist/theme.css` (a Tailwind v4 `@theme` block) imported by `apps/frontend/src/app/globals.css` and, later, by `apps/mobile`.
- Use the Tailwind classes `bg-brand-purple`, `text-brand-yellow`, etc. Use `colors.brand.*` from `@vet-plan/tokens` where classes don't apply (canvas overlays, native APIs). NEVER hardcode the hex values.
- **Monogram Assets:** VP Monogram, V Angle Icons, Centered Text Logo.

## 3. Package Management & Commands
- **PackageManager:** `pnpm@11` (or local corepack equivalent).
- **Build All:** `pnpm build`
- **Dev Mode:** `pnpm dev` (or a single app: `pnpm --filter @vet-plan/frontend dev`)
- **Lint All:** `pnpm lint`
- **Test All:** `pnpm test` (backend e2e: `pnpm --filter @vet-plan/backend test:e2e`)
- **Database Migrations:** `pnpm --filter @vet-plan/backend migration:run` (script not yet defined; arrives with the TypeORM data source in Phase 1)

## 4. Coding Standards & Governance
- **TypeScript:** Strict mode enabled. No `any` casts without explicit justification.
- **ESM Imports:** `apps/backend`, `packages/shared`, and `packages/tokens` compile with `nodenext`. Relative imports MUST end in `.js` (`./cases.module.js`). Package imports NEVER get an extension (`@vet-plan/shared`, not `@vet-plan/shared.js`). Next.js and Expo code uses bundler resolution and needs no extensions.
- **Backend Auth:** Social login via Passport (Google, LinkedIn, Facebook) + JWT. `JwtAuthGuard` and `RolesGuard` are global and deny by default: every route MUST declare `@Roles(...)` or `@Public()`. Do NOT add `@UseGuards` to controllers.
- **Cross-Platform Code:** `packages/ui` and `packages/app` MUST NOT import from `next/*`, `expo-*`, or app folders. Use `solito/navigation` and `solito/link` for routing. Rules in `docs/ARCHITECTURE.md` §4.
- **Telemetry:** Expose OpenTelemetry metrics via `/metrics` on NestJS; do NOT introduce proprietary paid SaaS SDKs.
- **Git Commit Style:** Conventional Commits (`feat(...)`, `fix(...)`, `chore(...)`).

## 5. Security Restrictions
- NEVER commit secrets or `.env` files. Document new keys in `.env.example`.
- ALWAYS maintain strict `.gitignore` rules for `node_modules`, `.pnpm-store`, build outputs, and `.env`.

## 6. Monorepo Directory Structure & File Blueprint
Folders marked *(planned)* hold only a README with bootstrap steps until their roadmap phase starts.

vetplan-monorepo/
├── apps/
│   ├── frontend/                   # Next.js 16 App Router (web)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)/         # Login / Social Auth Routes
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── (dashboard)/    # Main Surgical Planning Workspace
│   │   │   │   │   ├── cases/      # Thin route files rendering screens from @vet-plan/app
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── globals.css     # Imports @vet-plan/tokens/theme.css
│   │   │   │   ├── layout.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── components/
│   │   │   │   └── canvas/         # Web-only DICOM Viewer & Angle Measuring Tools
│   │   │   └── lib/                # Web-only helpers (next-intl config, cookies)
│   │   ├── public/                 # Monogram Logos & Static Assets
│   │   ├── next.config.ts
│   │   └── package.json
│   │
│   ├── mobile/                     # (planned) Expo SDK 58 + Expo Router + NativeWind
│   │   └── README.md               # Bootstrap steps
│   │
│   └── backend/                    # NestJS REST API & Microservices
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/           # Passport Social Logins, JWT Strategy & Global Guards
│       │   │   ├── cases/          # Orthopedic Surgical Cases & Measurements
│       │   │   ├── ai-bot/         # Gemini 2.5 Flash Triage & Telegram Webhook
│       │   │   └── telemetry/      # OpenTelemetry & Prometheus /metrics
│       │   ├── config/             # TypeORM, Neon Postgres, & Redis Setup
│       │   ├── app.module.ts
│       │   ├── tracing.ts          # OpenTelemetry Exporter Initialization
│       │   └── main.ts
│       ├── test/
│       └── package.json
│
├── packages/                       # Shared Internal Workspace Packages
│   ├── shared/                     # DTOs, Enums (Role…), pure surgical math. No React.
│   ├── tokens/                     # Design tokens (TS + generated Tailwind theme.css)
│   ├── ui/                         # (planned) Cross-platform primitives: Button, Card, Input
│   ├── app/                        # (planned) Cross-platform screens, API client, solito navigation
│   └── config/                     # (planned) Shared ESLint, TS, Prettier Configs
│
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
- `docs/ARCHITECTURE.md` — System design, security rules, and cross-platform layering.
- `apps/mobile/README.md`, `packages/ui/README.md`, `packages/app/README.md` — Step-by-step bootstrap guides for the planned packages.
