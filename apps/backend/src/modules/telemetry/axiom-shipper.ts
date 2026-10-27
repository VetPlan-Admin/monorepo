export interface LogEvent {
    _time: string;
    level: string;
    message: string;
    context?: string;
    [key: string]: unknown;
}

export interface AxiomShipperOptions {
    /** `https://<edge domain>/v1/ingest/<dataset>` */
    ingestUrl: string;
    token: string;
    fetchImpl?: typeof fetch;
    maxBatch?: number;
    flushIntervalMs?: number;
}

/**
 * Batches log events and sends them to Axiom's HTTP ingest API as NDJSON (no SDK).
 * Failures are reported on stderr, never through the logger (that would recurse).
 * Cloud Run note: with request-based billing, timers only run while a request is active, so a
 * batch may wait for the next request; `flush()` runs on shutdown (SIGTERM) as well.
 */
export class AxiomShipper {
    private buffer: LogEvent[] = [];
    private timer: NodeJS.Timeout | undefined;
    private readonly fetchImpl: typeof fetch;
    private readonly maxBatch: number;
    private readonly flushIntervalMs: number;

    constructor(private readonly options: AxiomShipperOptions) {
        this.fetchImpl = options.fetchImpl ?? fetch;
        this.maxBatch = options.maxBatch ?? 100;
        this.flushIntervalMs = options.flushIntervalMs ?? 2000;
    }

    push(event: LogEvent): void {
        this.buffer.push(event);
        if (this.buffer.length >= this.maxBatch) {
            void this.flush();
        } else if (!this.timer) {
            this.timer = setTimeout(() => void this.flush(), this.flushIntervalMs);
            this.timer.unref();
        }
    }

    async flush(): Promise<void> {
        clearTimeout(this.timer);
        this.timer = undefined;
        if (this.buffer.length === 0) return;
        const batch = this.buffer.splice(0);
        try {
            const response = await this.fetchImpl(this.options.ingestUrl, {
                method: 'POST',
                headers: { Authorization: `Bearer ${this.options.token}`, 'Content-Type': 'application/x-ndjson' },
                body: batch.map((event) => JSON.stringify(event)).join('\n'),
            });
            if (!response.ok) {
                process.stderr.write(`Axiom ingest failed with HTTP ${response.status}; dropped ${batch.length} log events\n`);
            }
        } catch (error) {
            process.stderr.write(`Axiom ingest unreachable (${String(error)}); dropped ${batch.length} log events\n`);
        }
    }
}
