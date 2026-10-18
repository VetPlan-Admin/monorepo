'use client';

import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from '../../provider/api-provider';

export type ApiHealthStatus = 'checking' | 'online' | 'offline';

/** Pings the public `GET /health` endpoint; `refresh()` re-checks on demand. */
export function useApiHealth(): { status: ApiHealthStatus; refresh: () => void } {
    const client = useApiClient();
    const [status, setStatus] = useState<ApiHealthStatus>('checking');
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        client
            .getHealth(controller.signal)
            .then(() => setStatus('online'))
            .catch(() => {
                if (!controller.signal.aborted) {
                    setStatus('offline');
                }
            });
        return () => controller.abort();
    }, [client, attempt]);

    const refresh = useCallback(() => {
        setStatus('checking');
        setAttempt((n) => n + 1);
    }, []);

    return { status, refresh };
}
