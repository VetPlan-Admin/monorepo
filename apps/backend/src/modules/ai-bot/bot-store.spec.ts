import { MemoryBotStore, UpstashBotStore } from './bot-store.js';

describe('MemoryBotStore', () => {
    it('de-duplicates keys and counts within a window', async () => {
        vi.useFakeTimers();
        const store = new MemoryBotStore();
        expect(await store.markIfNew('u:1', 60)).toBe(true);
        expect(await store.markIfNew('u:1', 60)).toBe(false);
        expect(await store.increment('c:1', 60)).toBe(1);
        expect(await store.increment('c:1', 60)).toBe(2);
        vi.advanceTimersByTime(61_000);
        expect(await store.markIfNew('u:1', 60)).toBe(true);
        expect(await store.increment('c:1', 60)).toBe(1);
        vi.useRealTimers();
    });
});

describe('UpstashBotStore', () => {
    it('speaks the Upstash REST protocol', async () => {
        const results = ['OK', null, 1, 1, 2];
        const fetchImpl = vi.fn(async () => Response.json({ result: results.shift() }));
        const store = new UpstashBotStore('https://redis.test', 'secret', fetchImpl);

        expect(await store.markIfNew('u:1', 86400)).toBe(true);
        expect(await store.markIfNew('u:1', 86400)).toBe(false);
        expect(await store.increment('c:1', 3600)).toBe(1); // INCR + EXPIRE on the first hit
        expect(await store.increment('c:1', 3600)).toBe(2);

        const bodies = fetchImpl.mock.calls.map((call) => JSON.parse((call as unknown as [string, RequestInit])[1].body as string));
        expect(bodies).toEqual([
            ['SET', 'u:1', '1', 'NX', 'EX', 86400],
            ['SET', 'u:1', '1', 'NX', 'EX', 86400],
            ['INCR', 'c:1'],
            ['EXPIRE', 'c:1', 3600],
            ['INCR', 'c:1'],
        ]);
        expect((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].headers).toMatchObject({ Authorization: 'Bearer secret' });
    });

    it('surfaces HTTP errors (the bot then fails open)', async () => {
        const store = new UpstashBotStore('https://redis.test', 's', vi.fn(async () => new Response('', { status: 503 })));
        await expect(store.increment('k', 1)).rejects.toThrow('HTTP 503');
    });
});
