'use client';

import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from '../provider/api-provider';
import type { ApiClient } from './api-client';

export interface ApiQueryState<T> {
    data?: T;
    error?: unknown;
    loading: boolean;
    reload: () => void;
}

/**
 * Loads data with the shared API client; re-runs when `key` changes and aborts stale requests.
 * `key` must capture every input of `load` (e.g. JSON of the filters).
 */
export function useApiQuery<T>(key: string, load: (client: ApiClient, signal: AbortSignal) => Promise<T>): ApiQueryState<T> {
    const client = useApiClient();
    const [state, setState] = useState<{ key?: string; data?: T; error?: unknown }>({});
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        load(client, controller.signal).then(
            (data) => setState({ key, data }),
            (error: unknown) => {
                if (!controller.signal.aborted) setState({ key, error });
            },
        );
        return () => controller.abort();
        // `load` is intentionally excluded: `key` identifies its inputs
    }, [client, key, attempt]);

    const reload = useCallback(() => setAttempt((n) => n + 1), []);
    const current = state.key === key;
    return {
        data: current ? state.data : undefined,
        error: current ? state.error : undefined,
        loading: !current || (state.data === undefined && state.error === undefined),
        reload,
    };
}
