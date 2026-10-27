import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { MeterProvider } from '@opentelemetry/sdk-metrics';

/**
 * OpenTelemetry metrics, exposed in Prometheus format at `GET /metrics` (MetricsController)
 * instead of the exporter's own port, so one Cloud Run port serves everything.
 * Grafana Cloud scrapes it (pull), which suits Cloud Run: no background export after responses.
 */
export const prometheusExporter = new PrometheusExporter({ preventServerStart: true });

const meterProvider = new MeterProvider({
    resource: resourceFromAttributes({ 'service.name': 'vet-plan-backend' }),
    readers: [prometheusExporter],
});

const meter = meterProvider.getMeter('vet-plan-backend');

/** Labelled by route template (`/cases/:id`), never by raw URL, to keep cardinality bounded. */
export const httpServerDuration = meter.createHistogram('http.server.request.duration', {
    unit: 's',
    description: 'Duration of HTTP requests handled by the API',
});

export const llmRequestDuration = meter.createHistogram('vetplan.llm.request.duration', {
    unit: 's',
    description: 'Duration of LLM provider calls by provider and outcome',
});

export const supportTriageCounter = meter.createCounter('vetplan.support.triage', {
    description: 'Support messages triaged, by source (llm | fallback) and category',
});

export const supportIssuesCounter = meter.createCounter('vetplan.support.github_issues', {
    description: 'GitHub issues created by the support bot, by outcome',
});
