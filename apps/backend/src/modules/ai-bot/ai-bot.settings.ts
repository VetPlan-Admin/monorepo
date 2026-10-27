import type { ConfigService } from '@nestjs/config';
import type { LlmProviderConfig } from './llm/llm-provider.js';

/** Injection tokens (overridable in tests). */
export const AI_BOT_SETTINGS = Symbol('AI_BOT_SETTINGS');
export const HTTP_FETCH = Symbol('HTTP_FETCH');
export const BOT_STORE = Symbol('BOT_STORE');

export type HttpFetch = typeof fetch;

export interface AiBotSettings {
    /** null = bot disabled (webhook answers 404). */
    telegram: { botToken: string; webhookSecret: string } | null;
    /** Tried in order; empty = every message goes to the human queue untriaged. */
    providers: LlmProviderConfig[];
    github: { token: string; owner: string; repo: string } | null;
    upstash: { restUrl: string; restToken: string } | null;
    rateLimitPerHour: number;
}

export const DEFAULT_WORKERS_AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-20b';

/**
 * Provider chain (docs/ARCHITECTURE.md §9): Cloudflare Workers AI first (free 10k neurons/day,
 * no training on or retention of inputs), Groq as fallback (free tier, no retention by default).
 * Both speak the OpenAI chat-completions protocol, so switching is configuration only.
 */
export function loadAiBotSettings(config: ConfigService): AiBotSettings {
    const get = (key: string) => config.get<string>(key)?.trim() || undefined;
    const providers: LlmProviderConfig[] = [];

    const accountId = get('CLOUDFLARE_ACCOUNT_ID');
    const cloudflareToken = get('CLOUDFLARE_API_TOKEN');
    if (accountId && cloudflareToken) {
        providers.push({
            name: 'workers-ai',
            baseUrl: `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/v1`,
            apiKey: cloudflareToken,
            model: get('WORKERS_AI_MODEL') ?? DEFAULT_WORKERS_AI_MODEL,
            // Workers AI JSON mode is model-specific and best-effort: ask in the prompt and validate
            structuredOutput: 'none',
        });
    }

    const groqKey = get('GROQ_API_KEY');
    if (groqKey) {
        const model = get('GROQ_MODEL') ?? DEFAULT_GROQ_MODEL;
        providers.push({
            name: 'groq',
            baseUrl: 'https://api.groq.com/openai/v1',
            apiKey: groqKey,
            model,
            // Groq enforces strict JSON Schema on gpt-oss models
            structuredOutput: model.startsWith('openai/gpt-oss') ? 'json_schema' : 'none',
            extraBody: model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : undefined,
        });
    }

    const botToken = get('TELEGRAM_BOT_TOKEN');
    const webhookSecret = get('TELEGRAM_WEBHOOK_SECRET');
    const githubToken = get('GITHUB_TOKEN');
    const owner = get('GITHUB_OWNER');
    const repo = get('GITHUB_REPO');
    const restUrl = get('UPSTASH_REDIS_REST_URL');
    const restToken = get('UPSTASH_REDIS_REST_TOKEN');
    const rateLimit = Number(get('SUPPORT_BOT_RATE_LIMIT_PER_HOUR') ?? 10);

    return {
        telegram: botToken && webhookSecret ? { botToken, webhookSecret } : null,
        providers,
        github: githubToken && owner && repo ? { token: githubToken, owner, repo } : null,
        upstash: restUrl && restToken ? { restUrl: restUrl.replace(/\/+$/, ''), restToken } : null,
        rateLimitPerHour: Number.isInteger(rateLimit) && rateLimit > 0 ? rateLimit : 10,
    };
}
