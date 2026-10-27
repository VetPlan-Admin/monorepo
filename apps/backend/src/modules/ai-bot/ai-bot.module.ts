import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_BOT_SETTINGS, BOT_STORE, HTTP_FETCH, loadAiBotSettings } from './ai-bot.settings.js';
import type { AiBotSettings, HttpFetch } from './ai-bot.settings.js';
import { MemoryBotStore, UpstashBotStore } from './bot-store.js';
import { GitHubIssuesService } from './github-issues.service.js';
import { LlmService } from './llm/llm.service.js';
import { SupportBotService } from './support-bot.service.js';
import { TelegramClient } from './telegram.client.js';
import { TelegramWebhookController } from './telegram-webhook.controller.js';
import { TriageService } from './triage.service.js';

/** Telegram support bot: redaction → LLM triage (Workers AI, Groq fallback) → GitHub issue → reply. */
@Module({
    controllers: [TelegramWebhookController],
    providers: [
        { provide: AI_BOT_SETTINGS, inject: [ConfigService], useFactory: loadAiBotSettings },
        // Wrapped so tests can replace every outbound HTTP call (LLMs, Telegram, GitHub, Upstash)
        { provide: HTTP_FETCH, useValue: ((input, init) => fetch(input, init)) satisfies HttpFetch },
        {
            provide: BOT_STORE,
            inject: [AI_BOT_SETTINGS, HTTP_FETCH],
            useFactory: (settings: AiBotSettings, fetchImpl: HttpFetch) =>
                settings.upstash ? new UpstashBotStore(settings.upstash.restUrl, settings.upstash.restToken, fetchImpl) : new MemoryBotStore(),
        },
        LlmService,
        TriageService,
        TelegramClient,
        GitHubIssuesService,
        SupportBotService,
    ],
})
export class AiBotModule { }
