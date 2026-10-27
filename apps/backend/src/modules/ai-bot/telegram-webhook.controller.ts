import { timingSafeEqual } from 'node:crypto';
import { Body, Controller, Headers, HttpCode, Inject, Logger, NotFoundException, Post, UnauthorizedException } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';
import { AI_BOT_SETTINGS } from './ai-bot.settings.js';
import type { AiBotSettings } from './ai-bot.settings.js';
import { SupportBotService } from './support-bot.service.js';
import type { HandledAs } from './support-bot.service.js';
import { telegramUpdateSchema } from './telegram-update.js';

@Controller('ai-bot/telegram')
export class TelegramWebhookController {
    private readonly logger = new Logger(TelegramWebhookController.name);

    constructor(
        @Inject(AI_BOT_SETTINGS) private readonly settings: AiBotSettings,
        private readonly supportBot: SupportBotService,
    ) { }

    /**
     * Telegram webhook (register it with `pnpm --filter @vet-plan/backend telegram:set-webhook`).
     * Authenticated by the secret Telegram echoes in `X-Telegram-Bot-Api-Secret-Token`, so it is
     * @Public() for the JWT guard. Always answers 200 once authenticated: a non-2xx makes Telegram
     * retry, and a failure here should not turn into a retry storm.
     */
    @Public()
    @Post('webhook')
    @HttpCode(200)
    async webhook(
        @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
        @Body() body: unknown,
    ): Promise<{ ok: true; handledAs: HandledAs | 'invalid' | 'error' }> {
        const telegram = this.settings.telegram;
        if (!telegram) {
            throw new NotFoundException();
        }
        const expected = Buffer.from(telegram.webhookSecret);
        const received = Buffer.from(secret ?? '');
        if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
            throw new UnauthorizedException();
        }

        const update = telegramUpdateSchema.safeParse(body);
        if (!update.success) {
            return { ok: true, handledAs: 'invalid' };
        }
        try {
            return { ok: true, handledAs: await this.supportBot.handleUpdate(update.data) };
        } catch (error) {
            this.logger.error(`Support bot failed on update ${update.data.update_id}: ${error instanceof Error ? error.message : String(error)}`);
            return { ok: true, handledAs: 'error' };
        }
    }
}
