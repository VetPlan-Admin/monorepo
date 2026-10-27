// Registers the support bot's webhook with Telegram (run once per deployment URL).
// Usage: pnpm --filter @vet-plan/backend telegram:set-webhook [public-base-url]
//        defaults to API_URL. Telegram needs a public HTTPS URL: use the Cloud Run URL, or for
//        local testing a free tunnel such as `cloudflared tunnel --url http://localhost:4000`.
for (const file of ['.env', '../../.env']) {
    try {
        process.loadEnvFile(file);
    } catch {
        // optional
    }
}

const { TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, API_URL } = process.env;
const base = process.argv[2] ?? API_URL;
if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_WEBHOOK_SECRET || !base) {
    console.error('Set TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and API_URL (or pass the public base URL).');
    process.exit(1);
}
if (!/^[A-Za-z0-9_-]{1,256}$/.test(TELEGRAM_WEBHOOK_SECRET)) {
    console.error('TELEGRAM_WEBHOOK_SECRET may only contain A-Z, a-z, 0-9, _ and - (1–256 characters).');
    process.exit(1);
}

const url = new URL('/ai-bot/telegram/webhook', base).toString();
const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, secret_token: TELEGRAM_WEBHOOK_SECRET, allowed_updates: ['message'], drop_pending_updates: true }),
});
const result = await response.json();
console.log(result.ok ? `Webhook set to ${url}` : `Telegram refused the webhook: ${result.description}`);
process.exit(result.ok ? 0 : 1);
