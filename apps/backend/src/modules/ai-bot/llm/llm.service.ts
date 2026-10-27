import { Inject, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import type { ZodType } from 'zod';
import { llmRequestDuration } from '../../telemetry/metrics.js';
import { AI_BOT_SETTINGS, HTTP_FETCH } from '../ai-bot.settings.js';
import type { AiBotSettings, HttpFetch } from '../ai-bot.settings.js';
import { LlmProviderError, requestJsonCompletion } from './llm-provider.js';
import type { ChatMessage } from './llm-provider.js';

export interface StructuredCompletion<T> {
    value: T;
    provider: string;
    model: string;
}

/** Tries each configured provider in order until one returns output that passes the schema. */
@Injectable()
export class LlmService {
    private readonly logger = new Logger(LlmService.name);

    constructor(
        @Inject(AI_BOT_SETTINGS) private readonly settings: AiBotSettings,
        @Inject(HTTP_FETCH) private readonly fetchImpl: HttpFetch,
    ) { }

    async completeStructured<T>(messages: ChatMessage[], schema: ZodType<T>, name: string): Promise<StructuredCompletion<T> | null> {
        const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
        delete jsonSchema.$schema;

        for (const provider of this.settings.providers) {
            const started = performance.now();
            let outcome = 'ok';
            try {
                const raw = await requestJsonCompletion(provider, messages, { name, jsonSchema }, this.fetchImpl);
                const parsed = schema.safeParse(raw);
                if (!parsed.success) {
                    throw new LlmProviderError(provider.name, 'invalid_output', 'response does not match the schema');
                }
                return { value: parsed.data, provider: provider.name, model: provider.model };
            } catch (error) {
                outcome = error instanceof LlmProviderError ? error.kind : 'error';
                this.logger.warn(`LLM provider "${provider.name}" failed (${outcome}); trying the next one`);
            } finally {
                llmRequestDuration.record((performance.now() - started) / 1000, { provider: provider.name, outcome });
            }
        }
        return null;
    }
}
