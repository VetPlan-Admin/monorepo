import { Injectable } from '@nestjs/common';
import { supportTriageCounter } from '../telemetry/metrics.js';
import { LlmService } from './llm/llm.service.js';
import { redactPersonalData } from './redaction.js';
import { TRIAGE_SYSTEM_PROMPT, triageResultSchema, triageUserMessage } from './triage.js';
import type { TriageResult } from './triage.js';

const MAX_INPUT_CHARS = 4000;

export interface TriageOutcome extends TriageResult {
    /** `llm` = classified by a model; `fallback` = no provider succeeded, a human must triage. */
    source: 'llm' | 'fallback';
    provider?: string;
    model?: string;
    redactedText: string;
    redactions: Record<string, number>;
}

@Injectable()
export class TriageService {
    constructor(private readonly llm: LlmService) { }

    async triage(text: string): Promise<TriageOutcome> {
        const { text: redactedText, redactions } = redactPersonalData(text.slice(0, MAX_INPUT_CHARS));
        const completion = await this.llm.completeStructured(
            [
                { role: 'system', content: TRIAGE_SYSTEM_PROMPT },
                { role: 'user', content: triageUserMessage(redactedText) },
            ],
            triageResultSchema,
            'support_triage',
        );

        const outcome: TriageOutcome = completion
            ? {
                  ...completion.value,
                  title: completion.value.title.slice(0, 120),
                  summary: completion.value.summary.slice(0, 2000),
                  reply: completion.value.reply.slice(0, 1000),
                  source: 'llm',
                  provider: completion.provider,
                  model: completion.model,
                  redactedText,
                  redactions,
              }
            : {
                  category: 'other',
                  severity: 'medium',
                  title: `Support request: ${redactedText.replace(/\s+/g, ' ').slice(0, 80)}`,
                  summary: 'Automatic triage was unavailable; review the message below.',
                  reply: '',
                  source: 'fallback',
                  redactedText,
                  redactions,
              };
        supportTriageCounter.add(1, { source: outcome.source, category: outcome.category });
        return outcome;
    }
}
