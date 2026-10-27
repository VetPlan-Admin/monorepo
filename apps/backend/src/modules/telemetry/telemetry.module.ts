import { Module } from '@nestjs/common';
import type { OnApplicationShutdown } from '@nestjs/common';
import { getLogShipper } from './app-logger.js';
import { MetricsController } from './metrics.controller.js';

class LogFlushOnShutdown implements OnApplicationShutdown {
    async onApplicationShutdown(): Promise<void> {
        await getLogShipper()?.flush();
    }
}

@Module({
    controllers: [MetricsController],
    providers: [LogFlushOnShutdown],
})
export class TelemetryModule { }
