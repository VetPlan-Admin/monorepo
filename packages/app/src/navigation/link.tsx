'use client';

import { createContext, useContext } from 'react';
import type { ComponentType, ReactNode } from 'react';

export interface LinkProps {
    /** URL path, identical on web and mobile (e.g. `/cases`). */
    href: string;
    children: ReactNode;
}

interface Navigation {
    link: ComponentType<LinkProps>;
    navigate: (href: string) => void;
}

const NavigationContext = createContext<Navigation | null>(null);

export interface NavigationProviderProps extends Navigation {
    children: ReactNode;
}

/**
 * Solito-style navigation without a router dependency: shared screens render `<Link>` or call
 * `useNavigate()`, and each app injects its real router here (`next/link` + `useRouter` on web,
 * Expo Router on mobile). Solito 5 targets React Navigation, which Expo Router 58 replaced.
 */
export function NavigationProvider({ link, navigate, children }: NavigationProviderProps) {
    return <NavigationContext value={{ link, navigate }}>{children}</NavigationContext>;
}

function useNavigation(): Navigation {
    const navigation = useContext(NavigationContext);
    if (!navigation) {
        throw new Error('Navigation must be used within a NavigationProvider');
    }
    return navigation;
}

export function Link(props: LinkProps) {
    const { link: PlatformLink } = useNavigation();
    return <PlatformLink {...props} />;
}

/** Imperative navigation, e.g. after creating a record. */
export function useNavigate(): (href: string) => void {
    return useNavigation().navigate;
}
