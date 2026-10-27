import { Inject, Injectable } from '@nestjs/common';
import { AI_BOT_SETTINGS, HTTP_FETCH } from './ai-bot.settings.js';
import type { AiBotSettings, HttpFetch } from './ai-bot.settings.js';

const TELEGRAM_MAX_MESSAGE = 4096;

@Injectable()
export class TelegramClient {
    constructor(
        @Inject(AI_BOT_SETTINGS) private readonly settings: AiBotSettings,
        @Inject(HTTP_FETCH) private readonly fetchImpl: HttpFetch,
    ) { }

    /** Replies in the chat, quoting the user's message when possible. */
    async sendMessage(chatId: number, text: string, replyToMessageId?: number): Promise<void> {
        const telegram = this.settings.telegram;
        if (!telegram) return;
        const response = await this.fetchImpl(`https://api.telegram.org/bot${telegram.botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text.slice(0, TELEGRAM_MAX_MESSAGE),
                link_preview_options: { is_disabled: true },
                ...(replyToMessageId ? { reply_parameters: { message_id: replyToMessageId, allow_sending_without_reply: true } } : {}),
            }),
        });
        if (!response.ok) {
            throw new Error(`Telegram sendMessage failed with HTTP ${response.status}`);
        }
    }
}
