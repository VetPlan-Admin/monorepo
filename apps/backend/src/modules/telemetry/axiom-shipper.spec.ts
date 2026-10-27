import { AxiomShipper } from './axiom-shipper.js';

const event = (message: string) => ({ _time: '2026-10-27T00:00:00.000Z', level: 'log', message });

describe('AxiomShipper', () => {
    it('sends batches as NDJSON with the bearer token', async () => {
        const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
        const shipper = new AxiomShipper({ ingestUrl: 'https://axiom.test/v1/ingest/logs', token: 't', fetchImpl, maxBatch: 2 });

        shipper.push(event('one'));
        expect(fetchImpl).not.toHaveBeenCalled();
        shipper.push(event('two')); // reaching maxBatch flushes immediately
        await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledOnce());

        const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe('https://axiom.test/v1/ingest/logs');
        expect(init.headers).toEqual({ Authorization: 'Bearer t', 'Content-Type': 'application/x-ndjson' });
        expect((init.body as string).split('\n').map((line) => JSON.parse(line).message)).toEqual(['one', 'two']);
    });

    it('flushes on a timer and on demand, and reports failures on stderr only', async () => {
        vi.useFakeTimers();
        const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
        const fetchImpl = vi.fn(async () => new Response(null, { status: 403 }));
        const shipper = new AxiomShipper({ ingestUrl: 'https://axiom.test/x', token: 't', fetchImpl, flushIntervalMs: 1000 });

        shipper.push(event('late'));
        await vi.advanceTimersByTimeAsync(1000);
        expect(fetchImpl).toHaveBeenCalledOnce();
        expect(stderr).toHaveBeenCalledWith(expect.stringContaining('HTTP 403'));

        await shipper.flush(); // nothing pending: no request
        expect(fetchImpl).toHaveBeenCalledOnce();

        const unreachable = new AxiomShipper({ ingestUrl: 'https://axiom.test/x', token: 't', fetchImpl: vi.fn(async () => { throw new TypeError('down'); }) });
        unreachable.push(event('x'));
        await unreachable.flush();
        expect(stderr).toHaveBeenCalledWith(expect.stringContaining('unreachable'));
        stderr.mockRestore();
        vi.useRealTimers();
    });
});
