import { Inject, Injectable, Logger } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import { supportIssuesCounter } from '../telemetry/metrics.js';
import { AI_BOT_SETTINGS, HTTP_FETCH } from './ai-bot.settings.js';
import type { AiBotSettings, HttpFetch } from './ai-bot.settings.js';

export interface CreatedIssue {
    number: number;
    url: string;
}

/** Files support reports as issues in a (private) GitHub repository. */
@Injectable()
export class GitHubIssuesService {
    private readonly logger = new Logger(GitHubIssuesService.name);
    private readonly octokit: Octokit | null;

    constructor(
        @Inject(AI_BOT_SETTINGS) private readonly settings: AiBotSettings,
        @Inject(HTTP_FETCH) fetchImpl: HttpFetch,
    ) {
        this.octokit = settings.github
            ? new Octokit({ auth: settings.github.token, userAgent: 'vet-plan-support-bot', request: { fetch: fetchImpl } })
            : null;
    }

    async createIssue(issue: { title: string; body: string; labels: string[] }): Promise<CreatedIssue | null> {
        if (!this.octokit || !this.settings.github) {
            supportIssuesCounter.add(1, { outcome: 'disabled' });
            return null;
        }
        try {
            const { data } = await this.octokit.rest.issues.create({
                owner: this.settings.github.owner,
                repo: this.settings.github.repo,
                ...issue,
            });
            supportIssuesCounter.add(1, { outcome: 'created' });
            return { number: data.number, url: data.html_url };
        } catch (error) {
            supportIssuesCounter.add(1, { outcome: 'failed' });
            this.logger.error(`Creating the GitHub issue failed: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }
}
