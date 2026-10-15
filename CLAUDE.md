# Vet Plan — Monorepo AI Agent Guidelines

## 1. Project Overview & Architecture
- **Product:** Vet Plan — Multi-tenant SaaS for veterinary orthopedic surgical planning.
- **Cost Target:** $0/month operational costs utilizing free tiers (Neon Postgres, Upstash Redis, Grafana Cloud, Axiom, Gemini 2.5 Flash Free Tier).
- **Structure:** `pnpm` monorepo containing:
  - `apps/frontend`: Next.js 14 App Router, Tailwind CSS, Lucide Icons, `next-intl`.
  - `apps/backend`: NestJS ESM service, TypeORM, Passport.js, OpenTelemetry.
  - `packages/*`: Shared modules and config.

## 2. Branding & UI Design System
- **Dark Purple:** `#3B0764` (Primary background/accents)
- **Light Yellow:** `#FEF08A` (Primary CTA/high-contrast text)
- **Monogram Assets:** VP Monogram, V Angle Icons, Centered Text Logo.

## 3. Package Management & Commands
- **PackageManager:** `pnpm@11` (or local corepack equivalent).
- **Build All:** `pnpm build`
- **Dev Mode:** `pnpm dev`
- **Lint All:** `pnpm lint`
- **Database Migrations:** `pnpm --filter @vet-plan/backend migration:run`

## 4. Coding Standards & Governance
- **TypeScript:** Strict mode enabled. No `any` casts without explicit justification.
- **Backend Auth:** Social login via Passport (Google, LinkedIn, Facebook) + JWT.
- **Telemetry:** Expose OpenTelemetry metrics via `/metrics` on NestJS; do NOT introduce proprietary paid SaaS SDKs.
- **Git Commit Style:** Conventional Commits (`feat(...)`, `fix(...)`, `chore(...)`).

## 5. Security Restrictions
- NEVER commit secrets or `.env` files.
- ALWAYS maintain strict `.gitignore` rules for `node_modules` and `.pnpm-store`.

## 6. Monorepo Directory Structure & File Blueprint
vetplan-monorepo/
├── apps/
│   ├── frontend/                   # Next.js 14 App Router
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)/         # Login / Social Auth Routes
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── (dashboard)/    # Main Surgical Planning Workspace
│   │   │   │   │   ├── cases/      # Surgical Cases List & Detail
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── layout.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── components/         # Reusable UI & DICOM Canvas Components
│   │   │   │   ├── canvas/         # DICOM Viewer & Angle Measuring Tools
│   │   │   │   └── ui/             # High-Contrast Buttons, Cards, Inputs
│   │   │   └── lib/                # API Client, State, i18n Helpers
│   │   ├── public/                 # Monogram Logos & Static Assets
│   │   ├── next.config.mjs
│   │   ├── tailwind.config.ts      # Brand Colors (#3B0764 & #FEF08A)
│   │   └── package.json
│   │
│   └── backend/                    # NestJS REST API & Microservices
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/           # Passport Social Logins & JWT Guards
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
│   ├── shared/                     # Shared DTOs, Interfaces, & Constants
│   └── config/                     # Shared ESLint, TS, Prettier Configs
│
├── .gitignore                      # Strict Git exclusions
├── CLAUDE.md                       # AI Agent Guidelines & Architecture Specs
├── GEMINI.md                       # Symlink -> CLAUDE.md
├── package.json                    # Root package manager & workspace scripts
├── pnpm-workspace.yaml             # Monorepo packages & build rules
└── turbo.json                      # Turborepo task pipeline execution