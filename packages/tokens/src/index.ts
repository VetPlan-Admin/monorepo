// Single source of truth for Vet Plan design tokens.
// `pnpm build` also emits dist/theme.css (a Tailwind v4 @theme block) from these values,
// consumed by apps/frontend (Tailwind) and apps/mobile (NativeWind).

export const colors = {
    brand: {
        purple: '#3B0764', // Primary background / accents
        yellow: '#FEF08A', // Primary CTA / high-contrast text / canvas overlays
    },
} as const;

export type BrandColor = keyof typeof colors.brand;
