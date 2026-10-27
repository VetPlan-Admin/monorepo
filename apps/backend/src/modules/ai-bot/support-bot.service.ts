import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { AI_BOT_SETTINGS, BOT_STORE } from './ai-bot.settings.js';
import type { AiBotSettings } from './ai-bot.settings.js';
import type { BotStore } from './bot-store.js';
import { GitHubIssuesService } from './github-issues.service.js';
import { TelegramClient } from './telegram.client.js';
import { BOT_REPLIES, CATEGORY_LABELS, ISSUE_CATEGORIES } from './triage.js';
import type { TriageOutcome } from './triage.service.js';
import { TriageService } from './triage.service.js';
import type { TelegramUpdate } from './telegram-update.js';

const DEDUP_TTL_SECONDS = 24 * 60 * 60;
const RATE_WINDOW_SECONDS = 60 * 60;

export type HandledAs = 'ignored' | 'duplicate' | 'welcome' | 'rate_limited' | 'triaged';

/**
 * One Telegram message end to end. Runs entirely inside the webhook request: on Cloud Run with
 * request-based billing, CPU is throttled once the response is sent, so no background work.
 */
@Injectable()
export class SupportBotService {
    private readonly logger = new Logger(SupportBotService.name);

    constructor(
        @Inject(AI_BOT_SETTINGS) private readonly settings: AiBotSettings,
        @Inject(BOT_STORE) private readonly store: BotStore,
        private readonly triageService: TriageService,
        private readonly telegram: TelegramClient,
        private readonly githubIssues: GitHubIssuesService,
    ) { }

    /** Opaque, stable reference to a chat for issues and logs (no Telegram ids leave the server). */
    private chatReference(chatId: number): string {
        return createHash('sha256').update(`${this.settings.telegram?.webhookSecret}:${chatId}`).digest('hex').slice(0, 10);
    }

    private async firstTime(key: string, ttl: number): Promise<boolean> {
        try {
            return await this.store.markIfNew(key, ttl);
        } catch (error) {
            this.logger.warn(`Bot store unavailable (${String(error)}); processing without de-duplication`);
            return true;
        }
    }

    private async countMessage(chatId: number): Promise<number> {
        try {
            return await this.store.increment(`support:rate:${chatId}`, RATE_WINDOW_SECONDS);
        } catch (error) {
            this.logger.warn(`Bot store unavailable (${String(error)}); processing without rate limiting`);
            return 0;
        }
    }

    async handleUpdate(update: TelegramUpdate): Promise<HandledAs> {
        const message = update.message;
        // Private chats with people only: groups would leak other members' messages to triage
        if (!message?.text || message.chat.type !== 'private' || message.from?.is_bot) {
            return 'ignored';
        }
        // Telegram retries deliveries it considers failed; process each update once
        if (!(await this.firstTime(`support:update:${update.update_id}`, DEDUP_TTL_SECONDS))) {
            return 'duplicate';
        }

        const chatId = message.chat.id;
        const text = message.text.trim();
        if (/^\/(start|help)\b/i.test(text)) {
            await this.telegram.sendMessage(chatId, BOT_REPLIES.welcome);
            return 'welcome';
        }

        const count = await this.countMessage(chatId);
        if (count > this.settings.rateLimitPerHour) {
            if (count === this.settings.rateLimitPerHour + 1) {
                await this.telegram.sendMessage(chatId, BOT_REPLIES.rateLimited, message.message_id);
            }
            return 'rate_limited';
        }

        const outcome = await this.triageService.triage(text);
        const issue = ISSUE_CATEGORIES.has(outcome.category)
            ? await this.githubIssues.createIssue({
                  title: outcome.title,
                  body: this.issueBody(outcome, this.chatReference(chatId)),
                  labels: this.issueLabels(outcome),
              })
            : null;

        await this.telegram.sendMessage(chatId, this.replyText(outcome, issue?.number), message.message_id);
        this.logger.log(
            `Support message triaged: source=${outcome.source} category=${outcome.category} severity=${outcome.severity} issue=${issue?.number ?? '-'}`,
        );
        return 'triaged';
    }

    private replyText(outcome: TriageOutcome, issueNumber: number | undefined): string {
        if (outcome.category === 'clinical_question') return BOT_REPLIES.clinical;
        if (outcome.category === 'spam') return BOT_REPLIES.spam;
        const reply = outcome.source === 'llm' ? outcome.reply : BOT_REPLIES.fallback;
        return issueNumber ? `${reply}\n\nTicket #${issueNumber}` : reply;
    }

    private issueLabels(outcome: TriageOutcome): string[] {
        return [
            CATEGORY_LABELS[outcome.category],
            `severity:${outcome.severity}`,
            'source:telegram',
            ...(outcome.source === 'fallback' ? ['needs-triage'] : []),
        ];
    }

    private issueBody(outcome: TriageOutcome, chatReference: string): string {
        const redactions = Object.entries(outcome.redactions).map(([kind, count]) => `${kind} ×${count}`).join(', ') || 'none';
        const triagedBy = outcome.source === 'llm' ? `${outcome.provider} (\`${outcome.model}\`)` : 'unavailable (needs human triage)';
        const quoted = outcome.redactedText.split('\n').map((line) => `> ${line}`).join('\n');
        return [
            `**Category:** ${outcome.category} · **Severity:** ${outcome.severity} · **Source:** Telegram (chat \`${chatReference}\`)`,
            `**Triaged by:** ${triagedBy}`,
            '',
            '### Summary',
            outcome.summary,
            '',
            '### Message (personal data redacted)',
            quoted,
            '',
            `<sub>Created by the Vet Plan support bot. Redactions: ${redactions}.</sub>`,
        ].join('\n');
    }
}
