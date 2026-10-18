'use client';

import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { createApiClient } from '../lib/api-client';
import type { ApiClient } from '../lib/api-client';

const ApiClientContext = createContext<ApiClient | null>(null);

export interface ApiProviderProps {
    baseUrl: string;
    children: ReactNode;
}

/** Makes the backend client available to shared screens. Mount once near each app's root. */
export function ApiProvider({ baseUrl, children }: ApiProviderProps) {
    const client = useMemo(() => createApiClient({ baseUrl }), [baseUrl]);
    return <ApiClientContext value={client}>{children}</ApiClientContext>;
}

export function useApiClient(): ApiClient {
    const client = useContext(ApiClientContext);
    if (!client) {
        throw new Error('useApiClient must be used within an ApiProvider');
    }
    return client;
}
