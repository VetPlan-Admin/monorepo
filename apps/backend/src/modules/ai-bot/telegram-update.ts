import { z } from 'zod';

/** The part of Telegram's Update object the bot uses; anything else is ignored. */
export const telegramUpdateSchema = z.object({
    update_id: z.number().int(),
    message: z
        .object({
            message_id: z.number().int(),
            chat: z.object({ id: z.number().int(), type: z.string() }),
            from: z.object({ id: z.number().int(), is_bot: z.boolean() }).optional(),
            text: z.string().optional(),
        })
        .optional(),
});
export type TelegramUpdate = z.infer<typeof telegramUpdateSchema>;
