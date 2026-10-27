import type { HttpFetch } from '../ai-bot.settings.js';

export interface LlmProviderConfig {
    name: string;
    /** OpenAI-compatible base URL (…/v1); `/chat/completions` is appended. */
    baseUrl: string;
    apiKey: string;
    model: string;
    /** `json_schema`: send `response_format` (provider enforces it); `none`: prompt + validation only. */
    structuredOutput: 'json_schema' | 'none';
    extraBody?: Record<string, unknown>;
}

export interface ChatMessage {
    role: 'system' | 'user';
    content: string;
}

export type LlmFailure = 'rate_limited' | 'http_error' | 'invalid_output' | 'unreachable';

export class LlmProviderError extends Error {
    constructor(
        readonly provider: string,
        readonly kind: LlmFailure,
        message: string,
    ) {
        super(`${provider}: ${message}`);
        this.name = 'LlmProviderError';
    }
}

/**
 * Pulls a JSON object out of a model response: an object (some providers return parsed JSON),
 * a JSON string, a ```json fenced block, or JSON surrounded by prose.
 */
export function extractJsonObject(content: unknown): Record<string, unknown> | undefined {
    const isObject = (value: unknown): value is Record<string, unknown> =>
        typeof value === 'object' && value !== null && !Array.isArray(value);

    if (isObject(content)) {
        // Workers AI native JSON mode wraps the result in { response: {...} }
        return Object.keys(content).length === 1 && isObject(content.response) ? content.response : content;
    }
    if (typeof content !== 'string') {
        return undefined;
    }
    const text = content.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    const candidates = [text];
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) candidates.push(text.slice(start, end + 1));
    for (const candidate of candidates) {
        try {
            const parsed: unknown = JSON.parse(candidate);
            if (isObject(parsed)) return parsed;
        } catch {
            // try the next candidate
        }
    }
    return undefined;
}

/** One OpenAI-compatible chat completion that must return a JSON object. */
export async function requestJsonCompletion(
    provider: LlmProviderConfig,
    messages: ChatMessage[],
    schema: { name: string; jsonSchema: Record<string, unknown> },
    fetchImpl: HttpFetch,
    timeoutMs = 20_000,
): Promise<Record<string, unknown>> {
    const body = {
        model: provider.model,
        messages,
        temperature: 0.1,
        max_tokens: 1200,
        ...(provider.structuredOutput === 'json_schema'
            ? { response_format: { type: 'json_schema', json_schema: { name: schema.name, schema: schema.jsonSchema, strict: true } } }
            : {}),
        ...provider.extraBody,
    };

    let response: Response;
    try {
        response = await fetchImpl(`${provider.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${provider.apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(timeoutMs),
        });
    } catch (error) {
        throw new LlmProviderError(provider.name, 'unreachable', String(error));
    }
    if (!response.ok) {
        throw new LlmProviderError(provider.name, response.status === 429 ? 'rate_limited' : 'http_error', `HTTP ${response.status}`);
    }

    const data = (await response.json().catch(() => ({}))) as { choices?: { message?: { content?: unknown } }[] };
    const parsed = extractJsonObject(data.choices?.[0]?.message?.content);
    if (!parsed) {
        throw new LlmProviderError(provider.name, 'invalid_output', 'response is not a JSON object');
    }
    return parsed;
}
