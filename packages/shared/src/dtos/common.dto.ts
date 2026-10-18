import { z } from 'zod';

export const paginationQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export interface Paginated<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
}

/** Shape of a 400 response from the API's validation pipe. */
export interface ValidationErrorResponse {
    message: string;
    errors: { path: string; message: string }[];
}

/** Optional free text: trimmed, non-empty when present; `null` clears it. */
export const optionalText = (max: number) =>
    z.string().trim().min(1, { error: 'Leave empty or enter text' }).max(max, { error: `At most ${max} characters` }).nullish();

/** ISO calendar date (YYYY-MM-DD); `null` clears it. */
export const optionalDate = () => z.iso.date({ error: 'Use the format YYYY-MM-DD' }).nullish();
