'use client';

import { createContext, useContext } from 'react';
import type { ComponentType, ReactNode } from 'react';

export interface LinkProps {
    /** URL path, identical on web and mobile (e.g. `/cases`). */
    href: string;
    children: ReactNode;
}

const LinkContext = createContext<ComponentType<LinkProps> | null>(null);

export interface NavigationProviderProps {
    /** The platform's router link: `next/link` on web, Expo Router's `Link` on mobile. */
    link: ComponentType<LinkProps>;
    children: ReactNode;
}

/**
 * Solito-style navigation without a router dependency: shared screens render `<Link>`, and each
 * app injects its real router link here. (Solito 5 targets React Navigation, which Expo Router 58
 * replaced with a vendored fork, so it can't drive Expo Router 58 on native.)
 */
export function NavigationProvider({ link, children }: NavigationProviderProps) {
    return <LinkContext value={link}>{children}</LinkContext>;
}

export function Link(props: LinkProps) {
    const PlatformLink = useContext(LinkContext);
    if (!PlatformLink) {
        throw new Error('Link must be used within a NavigationProvider');
    }
    return <PlatformLink {...props} />;
}
