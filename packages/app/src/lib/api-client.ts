import type {
    CaseDetailDto,
    CaseQueryDto,
    CaseSummaryDto,
    CreateCaseDto,
    CreatePatientDto,
    CurrentUserDto,
    HealthResponseDto,
    Paginated,
    PatientDto,
    PatientQueryDto,
    RadiographPlanDto,
    SavePlanDto,
    UpdateCaseDto,
    ValidationErrorResponse,
} from '@vet-plan/shared';

export interface ApiClientOptions {
    /**
     * Backend base URL. Web uses the same-origin proxy (`/api/backend`), which attaches the
     * HTTP-only session; mobile uses the API URL directly with `getAccessToken`.
     */
    baseUrl: string;
    getAccessToken?: () => string | null | Promise<string | null>;
}

export class ApiError extends Error {
    constructor(
        readonly status: number,
        message: string,
        /** Field errors from a 400 validation response. */
        readonly fieldErrors: ValidationErrorResponse['errors'] = [],
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

type Query = Record<string, string | number | undefined>;

interface RequestOptions {
    query?: Query;
    body?: unknown;
    signal?: AbortSignal;
}

export interface ApiClient {
    /** Absolute or same-origin URL for links (e.g. the report download). */
    url(path: string): string;
    getHealth(signal?: AbortSignal): Promise<HealthResponseDto>;
    getCurrentUser(signal?: AbortSignal): Promise<CurrentUserDto>;
    listPatients(query?: Partial<PatientQueryDto>, signal?: AbortSignal): Promise<Paginated<PatientDto>>;
    createPatient(dto: CreatePatientDto): Promise<PatientDto>;
    listCases(query?: Partial<CaseQueryDto>, signal?: AbortSignal): Promise<Paginated<CaseSummaryDto>>;
    getCase(id: string, signal?: AbortSignal): Promise<CaseDetailDto>;
    createCase(dto: CreateCaseDto): Promise<CaseDetailDto>;
    updateCase(id: string, dto: UpdateCaseDto): Promise<CaseDetailDto>;
    createPlan(caseId: string, dto: SavePlanDto): Promise<RadiographPlanDto>;
    updatePlan(caseId: string, planId: string, dto: SavePlanDto): Promise<RadiographPlanDto>;
    deletePlan(caseId: string, planId: string): Promise<void>;
    reportUrl(caseId: string): string;
}

function queryString(query: Query = {}): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== '') params.set(key, String(value));
    }
    const text = params.toString();
    return text ? `?${text}` : '';
}

async function errorFrom(response: Response): Promise<ApiError> {
    let body: Partial<ValidationErrorResponse> & { message?: string | string[] } = {};
    try {
        body = (await response.json()) as typeof body;
    } catch {
        // Non-JSON error (e.g. proxy failure): fall back to the status text
    }
    const message = Array.isArray(body.message) ? body.message.join(', ') : (body.message ?? response.statusText);
    return new ApiError(response.status, message || `Request failed (${response.status})`, body.errors ?? []);
}

/** Typed backend client shared by web and mobile. Request/response types come from @vet-plan/shared. */
export function createApiClient({ baseUrl, getAccessToken }: ApiClientOptions): ApiClient {
    const root = baseUrl.replace(/\/+$/, '');
    const url = (path: string) => `${root}${path}`;

    async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
        const token = (await getAccessToken?.()) ?? null;
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        if (options.body !== undefined) headers['Content-Type'] = 'application/json';

        const response = await fetch(url(path) + queryString(options.query), {
            method,
            headers,
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
            signal: options.signal,
        });
        if (!response.ok) {
            throw await errorFrom(response);
        }
        return (response.status === 204 ? undefined : await response.json()) as T;
    }

    return {
        url,
        getHealth: (signal) => request('GET', '/health', { signal }),
        getCurrentUser: (signal) => request('GET', '/auth/me', { signal }),
        listPatients: (query, signal) => request('GET', '/patients', { query, signal }),
        createPatient: (dto) => request('POST', '/patients', { body: dto }),
        listCases: (query, signal) => request('GET', '/cases', { query, signal }),
        getCase: (id, signal) => request('GET', `/cases/${encodeURIComponent(id)}`, { signal }),
        createCase: (dto) => request('POST', '/cases', { body: dto }),
        updateCase: (id, dto) => request('PATCH', `/cases/${encodeURIComponent(id)}`, { body: dto }),
        createPlan: (caseId, dto) => request('POST', `/cases/${encodeURIComponent(caseId)}/plans`, { body: dto }),
        updatePlan: (caseId, planId, dto) =>
            request('PUT', `/cases/${encodeURIComponent(caseId)}/plans/${encodeURIComponent(planId)}`, { body: dto }),
        deletePlan: (caseId, planId) =>
            request('DELETE', `/cases/${encodeURIComponent(caseId)}/plans/${encodeURIComponent(planId)}`),
        reportUrl: (caseId) => url(`/cases/${encodeURIComponent(caseId)}/report`),
    };
}

/** User-facing text for an API failure. */
export function describeApiError(error: unknown): string {
    if (error instanceof ApiError) {
        if (error.status === 401) return 'Your session has expired. Sign in again.';
        if (error.status === 403) return "Your role doesn't allow this action.";
        return error.message;
    }
    return 'Vet Plan is unreachable right now. Check your connection and try again.';
}
