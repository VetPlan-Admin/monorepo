import type { CurrentUserDto, HealthResponseDto } from '@vet-plan/shared';

export interface ApiClientOptions {
    /** Backend base URL, e.g. `http://localhost:4000` (injected by each app). */
    baseUrl: string;
    /** Bearer token source. Web server code reads the session cookie; mobile reads secure storage. */
    getAccessToken?: () => string | null | Promise<string | null>;
}

export class ApiError extends Error {
    constructor(
        readonly status: number,
        message: string,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

export interface ApiClient {
    getHealth(signal?: AbortSignal): Promise<HealthResponseDto>;
    getCurrentUser(signal?: AbortSignal): Promise<CurrentUserDto>;
}

/** Typed backend client shared by web and mobile. Request/response types come from @vet-plan/shared. */
export function createApiClient({ baseUrl, getAccessToken }: ApiClientOptions): ApiClient {
    async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
        const token = (await getAccessToken?.()) ?? null;
        const response = await fetch(new URL(path, baseUrl), {
            signal,
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!response.ok) {
            throw new ApiError(response.status, `${path} failed with ${response.status}`);
        }
        return (await response.json()) as T;
    }

    return {
        getHealth: (signal) => request<HealthResponseDto>('/health', signal),
        getCurrentUser: (signal) => request<CurrentUserDto>('/auth/me', signal),
    };
}
