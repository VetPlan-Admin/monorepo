import { extractJsonObject, LlmProviderError, requestJsonCompletion } from './llm-provider.js';
import type { LlmProviderConfig } from './llm-provider.js';

const provider: LlmProviderConfig = { name: 'test', baseUrl: 'https://llm.test/v1', apiKey: 'k', model: 'm', structuredOutput: 'json_schema' };
const schema = { name: 'x', jsonSchema: { type: 'object' } };

function reply(content: unknown, status = 200) {
    return vi.fn(async () => Response.json({ choices: [{ message: { content } }] }, { status }));
}

describe('extractJsonObject', () => {
    it.each([
        [{ a: 1 }, { a: 1 }],
        [{ response: { a: 1 } }, { a: 1 }],
        ['{"a":1}', { a: 1 }],
        ['```json\n{"a":1}\n```', { a: 1 }],
        ['Sure! Here it is: {"a":1} Hope it helps.', { a: 1 }],
        ['[1,2]', undefined],
        ['no json here', undefined],
        [42, undefined],
    ])('%j → %j', (input, expected) => {
        expect(extractJsonObject(input)).toEqual(expected);
    });
});

describe('requestJsonCompletion', () => {
    it('sends an OpenAI-compatible request with a strict JSON schema', async () => {
        const fetchImpl = reply('{"ok":true}');
        await expect(requestJsonCompletion({ ...provider, extraBody: { reasoning_effort: 'low' } }, [{ role: 'user', content: 'hi' }], schema, fetchImpl)).resolves.toEqual({ ok: true });
        const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe('https://llm.test/v1/chat/completions');
        expect(init.headers).toMatchObject({ Authorization: 'Bearer k' });
        expect(JSON.parse(init.body as string)).toMatchObject({
            model: 'm',
            response_format: { type: 'json_schema', json_schema: { name: 'x', strict: true } },
            reasoning_effort: 'low',
        });
    });

    it('omits response_format for prompt-only providers', async () => {
        const fetchImpl = reply('{"ok":true}');
        await requestJsonCompletion({ ...provider, structuredOutput: 'none' }, [], schema, fetchImpl);
        expect(JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).not.toHaveProperty('response_format');
    });

    it('classifies failures', async () => {
        const kind = (promise: Promise<unknown>) => promise.then(() => 'none', (e: LlmProviderError) => e.kind);
        expect(await kind(requestJsonCompletion(provider, [], schema, reply('{}', 429)))).toBe('rate_limited');
        expect(await kind(requestJsonCompletion(provider, [], schema, reply('{}', 500)))).toBe('http_error');
        expect(await kind(requestJsonCompletion(provider, [], schema, reply('not json')))).toBe('invalid_output');
        expect(await kind(requestJsonCompletion(provider, [], schema, vi.fn(async () => { throw new TypeError('down'); })))).toBe('unreachable');
    });
});
