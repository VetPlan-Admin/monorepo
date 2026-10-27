import request from 'supertest';
import { HTTP_FETCH } from '../src/modules/ai-bot/ai-bot.settings.js';
import type { HttpFetch } from '../src/modules/ai-bot/ai-bot.settings.js';
import { BOT_REPLIES } from '../src/modules/ai-bot/triage.js';
import { createTestApp } from './utils/test-app.js';
import type { TestContext } from './utils/test-app.js';

/** Every external service the bot talks to, scripted per test. */
interface Call {
    url: string;
    body: Record<string, unknown> | undefined;
}

const SECRET = 'webhook-s3cret';
const triage = (fields: Record<string, string>) =>
    Response.json({
        choices: [{ message: { content: JSON.stringify({ category: 'bug', severity: 'high', title: 'Planner crashes', summary: 'The planner crashes.', reply: 'Obrigado pelo relato!', ...fields }) } }],
    });

describe('Support bot (e2e)', () => {
    let ctx: TestContext;
    let calls: Call[] = [];
    let workersAi: () => Response;
    let groq: () => Response;
    let nextUpdateId = 1000;
    // Each test talks from its own chat so the per-chat rate limit doesn't leak between tests
    let chat = 500;

    const fakeFetch: HttpFetch = async (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        calls.push({ url, body: typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined });
        if (url.startsWith('https://api.cloudflare.com/client/v4/accounts/acc-123/ai/v1/chat/completions')) return workersAi();
        if (url.startsWith('https://api.groq.com/openai/v1/chat/completions')) return groq();
        if (url.startsWith('https://api.telegram.org/bottg-token/sendMessage')) return Response.json({ ok: true, result: {} });
        if (url === 'https://api.github.com/repos/vetplan/support/issues') {
            return Response.json({ number: 42, html_url: 'https://github.com/vetplan/support/issues/42' }, { status: 201 });
        }
        throw new Error(`Unexpected request to ${url}`);
    };

    const callsTo = (prefix: string) => calls.filter((c) => c.url.startsWith(prefix));
    const telegramReplies = () => callsTo('https://api.telegram.org/').map((c) => c.body!);
    const issues = () => callsTo('https://api.github.com/').map((c) => c.body!);

    function send(text: string, overrides: { chatType?: string; isBot?: boolean; chatId?: number; updateId?: number; secret?: string } = {}) {
        return request(ctx.app.getHttpServer())
            .post('/ai-bot/telegram/webhook')
            .set('X-Telegram-Bot-Api-Secret-Token', overrides.secret ?? SECRET)
            .send({
                update_id: overrides.updateId ?? nextUpdateId++,
                message: {
                    message_id: 7,
                    chat: { id: overrides.chatId ?? chat, type: overrides.chatType ?? 'private' },
                    from: { id: 99, is_bot: overrides.isBot ?? false },
                    text,
                },
            });
    }

    beforeAll(async () => {
        Object.assign(process.env, {
            TELEGRAM_BOT_TOKEN: 'tg-token',
            TELEGRAM_WEBHOOK_SECRET: SECRET,
            CLOUDFLARE_ACCOUNT_ID: 'acc-123',
            CLOUDFLARE_API_TOKEN: 'cf-token',
            GROQ_API_KEY: 'groq-key',
            GITHUB_TOKEN: 'gh-token',
            GITHUB_OWNER: 'vetplan',
            GITHUB_REPO: 'support',
            SUPPORT_BOT_RATE_LIMIT_PER_HOUR: '3',
            METRICS_TOKEN: 'metrics-token',
        });
        ctx = await createTestApp({ overrides: (builder) => builder.overrideProvider(HTTP_FETCH).useValue(fakeFetch) });
    });

    beforeEach(() => {
        chat += 1;
        calls = [];
        workersAi = () => triage({});
        groq = () => triage({});
    });

    afterAll(async () => {
        await ctx.close();
    });

    it('rejects webhooks without the Telegram secret', async () => {
        await send('hello', { secret: '' }).expect(401);
        await send('hello', { secret: 'wrong-secret!!' }).expect(401);
        expect(calls).toEqual([]);
    });

    it('redacts, triages with Workers AI, files a GitHub issue and replies with the ticket', async () => {
        const res = await send('O planner trava ao abrir DICOM. Meu email é ana@clinica.com.br e tel (61) 99876-5432').expect(200);
        expect(res.body).toEqual({ ok: true, handledAs: 'triaged' });

        const [llm] = callsTo('https://api.cloudflare.com/');
        const prompt = JSON.stringify(llm!.body);
        expect(prompt).toContain('[EMAIL]');
        expect(prompt).toContain('[PHONE]');
        expect(prompt).not.toContain('ana@clinica.com.br');
        expect(prompt).not.toContain('99876');
        expect(llm!.body).toMatchObject({ model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' });
        expect(llm!.body).not.toHaveProperty('response_format');
        expect(callsTo('https://api.groq.com/')).toHaveLength(0);

        const [issue] = issues();
        expect(issue).toMatchObject({ title: 'Planner crashes', labels: ['bug', 'severity:high', 'source:telegram'] });
        expect(issue!.body).toContain('workers-ai');
        expect(issue!.body).toContain('Redactions: EMAIL ×1, PHONE ×1');
        expect(issue!.body).not.toContain('ana@clinica.com.br');
        expect(issue!.body).not.toContain(String(chat)); // the Telegram chat id never leaves the server

        expect(telegramReplies()).toEqual([
            expect.objectContaining({ chat_id: chat, text: 'Obrigado pelo relato!\n\nTicket #42', reply_parameters: { message_id: 7, allow_sending_without_reply: true } }),
        ]);
    });

    it('processes a retried update only once', async () => {
        await send('Bug report', { updateId: 5000 }).expect(200);
        calls = [];
        const res = await send('Bug report', { updateId: 5000 }).expect(200);
        expect(res.body.handledAs).toBe('duplicate');
        expect(calls).toEqual([]);
    });

    it('falls back to Groq (strict JSON schema) when Workers AI is rate limited', async () => {
        workersAi = () => new Response('{"errors":[{"message":"limit"}]}', { status: 429 });
        groq = () => triage({ category: 'feature_request', severity: 'low', title: 'Export annotated PNG' });
        await send('Seria ótimo exportar a imagem anotada').expect(200);

        const [groqCall] = callsTo('https://api.groq.com/');
        expect(groqCall!.body).toMatchObject({
            model: 'openai/gpt-oss-20b',
            reasoning_effort: 'low',
            response_format: { type: 'json_schema', json_schema: { name: 'support_triage', strict: true } },
        });
        expect(issues()[0]).toMatchObject({ title: 'Export annotated PNG', labels: ['enhancement', 'severity:low', 'source:telegram'] });
        expect(issues()[0]!.body).toContain('groq (`openai/gpt-oss-20b`)');
    });

    it('queues the message for a human when every provider fails', async () => {
        workersAi = () => Response.json({ choices: [{ message: { content: 'I cannot answer in JSON, sorry.' } }] });
        groq = () => new Response('boom', { status: 500 });
        await send('Não consigo salvar o plano').expect(200);

        expect(issues()[0]).toMatchObject({ labels: ['support', 'severity:medium', 'source:telegram', 'needs-triage'] });
        expect(issues()[0]!.title).toBe('Support request: Não consigo salvar o plano');
        expect(telegramReplies()[0]!.text).toBe(`${BOT_REPLIES.fallback}\n\nTicket #42`);
    });

    it('never relays model-written clinical advice and files no issue', async () => {
        workersAi = () => triage({ category: 'clinical_question', severity: 'low', reply: 'Use a 9 mm cage for this dog.' });
        await send('Qual cage devo usar para um labrador de 35 kg?').expect(200);
        expect(issues()).toHaveLength(0);
        expect(telegramReplies()[0]!.text).toBe(BOT_REPLIES.clinical);
    });

    it('drops spam without an issue', async () => {
        workersAi = () => triage({ category: 'spam', severity: 'low' });
        await send('Buy cheap followers').expect(200);
        expect(issues()).toHaveLength(0);
        expect(telegramReplies()[0]!.text).toBe(BOT_REPLIES.spam);
    });

    it('answers /start, and ignores groups, bots and malformed updates', async () => {
        expect((await send('/start')).body.handledAs).toBe('welcome');
        expect(telegramReplies()[0]!.text).toBe(BOT_REPLIES.welcome);
        expect((await send('bug!', { chatType: 'group' })).body.handledAs).toBe('ignored');
        expect((await send('bug!', { isBot: true })).body.handledAs).toBe('ignored');
        const invalid = await request(ctx.app.getHttpServer()).post('/ai-bot/telegram/webhook').set('X-Telegram-Bot-Api-Secret-Token', SECRET).send({ nope: true }).expect(200);
        expect(invalid.body.handledAs).toBe('invalid');
        expect(callsTo('https://api.cloudflare.com/')).toHaveLength(0);
    });

    it('rate limits each chat and warns only once', async () => {
        const chatId = 777;
        for (let i = 0; i < 3; i++) expect((await send(`message ${i}`, { chatId })).body.handledAs).toBe('triaged');
        calls = [];
        expect((await send('message 4', { chatId })).body.handledAs).toBe('rate_limited');
        expect((await send('message 5', { chatId })).body.handledAs).toBe('rate_limited');
        expect(telegramReplies().map((r) => r.text)).toEqual([BOT_REPLIES.rateLimited]);
        expect(callsTo('https://api.cloudflare.com/')).toHaveLength(0);
    });

    it('exposes bot metrics behind METRICS_TOKEN', async () => {
        await request(ctx.app.getHttpServer()).get('/metrics').expect(401);
        const res = await request(ctx.app.getHttpServer()).get('/metrics').set('Authorization', 'Bearer metrics-token').expect(200);
        expect(res.text).toContain('vetplan_support_triage_total');
        const llmCount = res.text.split('\n').find(
            (line) => line.startsWith('vetplan_llm_request_duration_count') && line.includes('provider="workers-ai"') && line.includes('outcome="rate_limited"'),
        );
        expect(llmCount).toBeDefined();
        expect(res.text).toContain('vetplan_support_github_issues_total');
    });
});
