import type { HttpFetch } from './ai-bot.settings.js';

/** Short-lived state for the bot: webhook de-duplication and per-chat rate limiting. */
export interface BotStore {
    /** True the first time `key` is seen within `ttlSeconds`. */
    markIfNew(key: string, ttlSeconds: number): Promise<boolean>;
    /** Increments a counter that expires `windowSeconds` after its first increment. */
    increment(key: string, windowSeconds: number): Promise<number>;
}

/** Single-instance fallback when Upstash isn't configured (state is lost on restart). */
export class MemoryBotStore implements BotStore {
    private readonly entries = new Map<string, { value: number; expiresAt: number }>();

    private live(key: string): { value: number; expiresAt: number } | undefined {
        const entry = this.entries.get(key);
        if (entry && entry.expiresAt <= Date.now()) {
            this.entries.delete(key);
            return undefined;
        }
        return entry;
    }

    async markIfNew(key: string, ttlSeconds: number): Promise<boolean> {
        if (this.live(key)) return false;
        this.entries.set(key, { value: 1, expiresAt: Date.now() + ttlSeconds * 1000 });
        return true;
    }

    async increment(key: string, windowSeconds: number): Promise<number> {
        const entry = this.live(key) ?? { value: 0, expiresAt: Date.now() + windowSeconds * 1000 };
        entry.value += 1;
        this.entries.set(key, entry);
        return entry.value;
    }
}

/**
 * Upstash Redis over its REST API (free tier, no TCP client or SDK): each command is a JSON
 * array POSTed to the database URL. Shared by every Cloud Run instance.
 */
export class UpstashBotStore implements BotStore {
    constructor(
        private readonly restUrl: string,
        private readonly restToken: string,
        private readonly fetchImpl: HttpFetch,
    ) { }

    private async command(args: (string | number)[]): Promise<unknown> {
        const response = await this.fetchImpl(this.restUrl, {
            method: 'POST',
            headers: { Authorization: `Bearer ${this.restToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(args),
        });
        if (!response.ok) {
            throw new Error(`Upstash responded with HTTP ${response.status}`);
        }
        return ((await response.json()) as { result: unknown }).result;
    }

    async markIfNew(key: string, ttlSeconds: number): Promise<boolean> {
        return (await this.command(['SET', key, '1', 'NX', 'EX', ttlSeconds])) === 'OK';
    }

    async increment(key: string, windowSeconds: number): Promise<number> {
        const value = Number(await this.command(['INCR', key]));
        if (value === 1) {
            await this.command(['EXPIRE', key, windowSeconds]);
        }
        return value;
    }
}
