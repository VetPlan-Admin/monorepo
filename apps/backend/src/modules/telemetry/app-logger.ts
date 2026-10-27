import { ConsoleLogger } from '@nestjs/common';
import type { LogLevel } from '@nestjs/common';
import { AxiomShipper } from './axiom-shipper.js';

/**
 * Nest console logger (JSON lines in production, which Cloud Logging parses) that also ships
 * every entry to Axiom when AXIOM_DOMAIN, AXIOM_DATASET and AXIOM_TOKEN are set.
 * Log metadata only: never message bodies from users or patient data.
 */
export class AppLogger extends ConsoleLogger {
    constructor(private readonly shipper: AxiomShipper | null, json: boolean) {
        super({ json, timestamp: !json });
    }

    protected override printMessages(
        messages: unknown[],
        context = '',
        logLevel: LogLevel = 'log',
        writeStreamType?: 'stdout' | 'stderr',
        errorStack?: unknown,
        params?: Record<string, unknown>,
    ): void {
        super.printMessages(messages, context, logLevel, writeStreamType, errorStack, params);
        if (!this.shipper) return;
        for (const message of messages) {
            this.shipper.push({
                _time: new Date().toISOString(),
                level: logLevel,
                context: context || undefined,
                message: typeof message === 'string' ? message : JSON.stringify(message),
                ...(errorStack ? { stack: typeof errorStack === 'string' ? errorStack : JSON.stringify(errorStack) } : {}),
                service: 'vet-plan-backend',
            });
        }
    }
}

let shipper: AxiomShipper | null | undefined;

/**
 * Shared by main.ts and the shutdown hook (TelemetryModule) so pending logs are flushed.
 * Resolved lazily: `.env` is only loaded once AppModule (ConfigModule.forRoot) has been evaluated.
 */
export function getLogShipper(): AxiomShipper | null {
    if (shipper === undefined) {
        const { AXIOM_DOMAIN, AXIOM_DATASET, AXIOM_TOKEN } = process.env;
        shipper =
            AXIOM_DOMAIN && AXIOM_DATASET && AXIOM_TOKEN
                ? new AxiomShipper({
                      ingestUrl: `https://${AXIOM_DOMAIN}/v1/ingest/${encodeURIComponent(AXIOM_DATASET)}`,
                      token: AXIOM_TOKEN,
                  })
                : null;
    }
    return shipper;
}

export function createAppLogger(): AppLogger {
    return new AppLogger(getLogShipper(), process.env.NODE_ENV === 'production');
}
