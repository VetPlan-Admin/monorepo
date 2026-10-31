# ZERO COST — Infrastructure and Database (reusable playbook)

The accounts, values and parameters needed to run a web/mobile SaaS on **free tiers only**, as set up
for Vet Plan. Reuse it for another app by replacing the placeholders in §2.

> Free-tier facts verified on **2026-10-31** against each provider's pricing/docs (links in §9).
> Free tiers change often (in 2026 alone GitHub Models was retired and Cerebras became a trial):
> re-check §9 before reusing.
> Vet Plan specifics: `docs/DEPLOYMENT.md` (step-by-step) and `docs/ARCHITECTURE.md` §3, §9–§11.

---

## 0. Rules that keep it at $0
1. **Budgets don't stop spending; they only alert.** The real protection is configuration: scale to zero,
   capped instances, request-based billing, image cleanup, one bundled secret (§4.4). On GCP, the Free
   Trial makes charges impossible for 90 days; after upgrading, only a billing kill switch is a hard stop.
2. Prefer providers that **block or error** at the free limit over ones that bill overage (Workers AI,
   Neon, Upstash, GitHub Actions without a card all stop or error).
3. **Secrets never go into chat, the repo, Dockerfiles or build files.** They go straight from the
   provider console into a password manager, then into the GCP secret bundle.
4. **Never add paid building blocks:** Cloud SQL, load balancers, Cloud NAT, VPC connectors, Cloud Armor,
   Memorystore, GPUs, Vertex AI. All are outside the GCP free tier.
5. Keep database and API **in the same metro** (§3) and in a **Tier 1** Cloud Run region.
6. AI on free tiers: only providers that **don't train on your inputs** (the Gemini API free tier does).

---

## 1. Account inventory

| # | Service | Used for | Plan | Card? | Sign up with | Free limits that matter |
|---|---|---|---|---|---|---|
| 1 | Password manager (e.g. Bitwarden) | Holding every secret below | Free | No | Email | — |
| 2 | **GitHub** | Code, Cloud Build source, support issues, CI | Free | No | — | Private repos: $12/month Actions credit (~2,000 Linux min); usage **blocked** at the limit without a card; public repos free |
| 3 | **Neon** | Postgres | Free (permanent) | No | GitHub | 1 GB/project, 100 CU-h/project/month, ≤2 CU, sleeps after 5 min (wakes in ~ms), 6 h restore window, 100 projects |
| 4 | **Google Cloud (GCP)** | API (Cloud Run), builds, images, secrets, OAuth client | Free trial → free tier | **Yes** (identity only; $0–1 hold, released) | Google account | See §4.4 |
| 5 | **Cloudflare** | Frontend hosting, Workers AI (LLM) | Free | No | Email | Workers: 100k req/day, **10 ms CPU/request**, 64 MiB bundle; Workers AI: 10,000 neurons/day (errors when exhausted) |
| 6 | Upstash | Redis over REST (rate limits, de-dup) | Free | No | GitHub/Google | 1 DB, 500K commands/month, 250 MB, 10 GB bandwidth |
| 7 | Groq | LLM fallback | Free | No | Google/GitHub | ~30 req/min, ~1,000 req/day per model (exact limits in the console) |
| 8 | Telegram | Support bot | Free | No | Phone | — |
| 9 | Axiom | Log storage/search | Personal (permanent) | No | GitHub/Google | 500 GB/month loading, 30-day retention, 10 GB-h query compute |
| 10 | Grafana Cloud | Metrics dashboards/alerts | Free | No | GitHub/Google | 10k active series, 50 GB logs/traces, 14-day retention, 3 users |
| 11 | OAuth apps: Google (in GCP), LinkedIn, Facebook | Social login | Free | No | Existing accounts | — |
| 12 | Apple Developer / Google Play | **Publishing mobile apps only** | **$99/year / $25 once** | Yes | — | The only unavoidable costs |

---

## 2. Placeholders for a new app

| Placeholder | Meaning | Vet Plan value |
|---|---|---|
| `<APP>` | Short kebab-case app id (names everything) | `vet-plan` |
| `<GITHUB_ORG>/<REPO>` | Repository | `VetPlan-Admin/monorepo` |
| `<NEON_REGION>` | Neon region | `aws-us-east-1` |
| `<GCP_REGION>` | Cloud Run region (Tier 1, same metro, §3) | `us-east4` |
| `<PROJECT_ID>` | GCP project id (shown at creation) | `vet-plan-…` |
| `<SERVICE>` / `<JOB>` | Cloud Run service / migration job | `vet-plan-api` / `vet-plan-migrate` |
| `<SECRET>` | Secret Manager bundle | `vet-plan-backend-env` |
| `<RUNTIME_SA>` / `<DEPLOYER_SA>` | Service accounts | `vet-plan-backend` / `vet-plan-deployer` |
| `<AR_REPO>` | Artifact Registry repository | `vet-plan` |
| `<API_URL>` | Cloud Run URL (after first deploy) | `https://vet-plan-api-….us-east4.run.app` |
| `<APP_URL>` | Frontend URL (after Cloudflare) | *pending* |

---

## 3. Region pairing (database ↔ API)

Cloud Run's free tier is a spending-based discount **at Tier 1 prices**, and free outbound data is
**1 GiB/month from North America**. Pick a Neon region, then the Tier 1 Cloud Run region in the same area:

| Neon (AWS) | Cloud Run (Tier 1) | Notes |
|---|---|---|
| `aws-us-east-1` N. Virginia | **`us-east4`** N. Virginia | Same metro (Vet Plan) |
| `aws-us-east-2` Ohio | `us-east5` Columbus | Same state |
| `aws-us-west-2` Oregon | `us-west1` Oregon | Same state |
| `aws-eu-central-1` Frankfurt | `europe-west4` Netherlands / `europe-west1` Belgium | `europe-west3` Frankfurt is **Tier 2** |
| `aws-eu-west-2` London | `europe-west1` Belgium | `europe-west2` London is **Tier 2** |
| `aws-sa-east-1` São Paulo | ✗ | `southamerica-east1` is **Tier 2** and outside the North America egress allowance: not $0 |
| `aws-ap-southeast-1` Singapore / `-2` Sydney | ✗ | `asia-southeast1`, `australia-southeast1` are **Tier 2** |

Tier 1 (2026-10): africa-south1, asia-east1, asia-northeast1/2, asia-south1, asia-southeast3/4,
europe-north1/2, europe-southwest1, europe-west1/4/8/9, me-west1, northamerica-south1, us-central1,
us-east1/4/5, us-south1, us-west1/8. A Neon region can't be changed after creation.

---

## 4. Per-account setup (values and parameters only)

### 4.1 Password manager
One entry per secret, named `<APP> · <KEY>` (e.g. `vet-plan · DATABASE_URL`). Everything in §5 marked
*secret* lives here until it's pasted into GCP.

### 4.2 GitHub
| Item | Value |
|---|---|
| Repository | private, default branch `main` |
| Cloud Build access | Install the **Google Cloud Build** GitHub App on **this repository only** (done from GCP, §4.4 F) |
| Support-issues token (bot) | Fine-grained token → repository = the issues repo (**private**) → permission **Issues: Read and write** → `GITHUB_TOKEN`, plus `GITHUB_OWNER`, `GITHUB_REPO` |
| CI (later) | GitHub Actions on pull requests (build, lint, test); free credit as in §1 |

### 4.3 Neon
| Item | Value |
|---|---|
| Sign up | **Continue with GitHub**, Free plan |
| Project | name `<APP>`, Postgres default (18), provider **AWS**, region `<NEON_REGION>` (§3) |
| Add-ons screen | **"Just Postgres for now"** (no Auth, Object storage, Functions, AI Gateway, Realtime) |
| Defaults to keep | branch `production`, database `neondb`, role `neondb_owner`, compute 0.25↔2 CU, history 6 h |
| Connection strings (*Connect* button) | Pooling **ON** → `DATABASE_URL` (host has `-pooler`; app, PgBouncer transaction mode) · Pooling **OFF** → `DATABASE_MIGRATION_URL` (migrations only). Keep the `?sslmode=require…` suffix |
| Leave alone | "Onboard your agent", IP restrictions (paid) |

### 4.4 Google Cloud
**A. Account and budget**
| Item | Value |
|---|---|
| Sign up | https://console.cloud.google.com → **Start free**: $300 credit / 90 days. Card (or other method) for identity and fraud checks only; a pending $0–1 authorization hold is released. Eligible only if never paid for Google Cloud, Maps or Firebase and no previous trial. Account type **Individual** |
| Why it's $0 | *"You will not be billed for any Google Cloud usage during your Free Trial"*, no automatic charges. Free Tier applies during the trial and doesn't use the credit. Credit exhausted or day 90 → account closes, resources stop, nothing billed |
| Never | Click **Activate / Upgrade** before the kill switch exists (it's the only step that allows charges) |
| Budget | *Billing → Budgets & alerts*: name `<APP>-zero`, **Monthly**, all projects/services, Savings: **untick Promotional credits** (trial credit hides spend), **keep Free tier credits**; specified amount 1 USD (or equivalent), thresholds 50/90/100 % actual + 100 % forecast, email billing admins and users |
| Trial end (decide by day 80) | *Let it close*: resources stop, 30-day grace to upgrade, then deleted ($0). *Keep running*: kill switch first (budget → Pub/Sub topic → function that unlinks billing; needs Project Billing Manager + Browser on the project), then *Activate*. Notifications arrive several times a day and can lag hours, so it caps a runaway, not to exactly $0; unlinking stops all services (free ones too) and may delete resources |

**B. Project and APIs** (Cloud Shell: `apps/backend/deploy/gcp-setup.sh`)
| Item | Value |
|---|---|
| Project | name `<APP>` → note `<PROJECT_ID>` |
| APIs | `run`, `cloudbuild`, `artifactregistry`, `secretmanager`, `iam`, `cloudresourcemanager` (`.googleapis.com`) |

**C. Artifact Registry**
| Item | Value |
|---|---|
| Repository | `<AR_REPO>`, format **Docker**, location `<GCP_REGION>` |
| Cleanup policy | Keep 2 most recent versions + delete anything older than 1 day (0.5 GiB free) |
```json
[
  { "name": "keep-2-newest", "action": { "type": "Keep" }, "mostRecentVersions": { "keepCount": 2 } },
  { "name": "delete-older", "action": { "type": "Delete" }, "condition": { "tagState": "any", "olderThan": "1d" } }
]
```

**D. Service accounts and roles**
| Account | Roles |
|---|---|
| `<RUNTIME_SA>` (Cloud Run runs as it) | `roles/secretmanager.secretAccessor` **on `<SECRET>` only** |
| `<DEPLOYER_SA>` (Cloud Build runs as it) | project: `roles/run.admin`, `roles/artifactregistry.writer`, `roles/logging.logWriter`; on `<RUNTIME_SA>`: `roles/iam.serviceAccountUser` |
No JSON keys are ever downloaded.

**E. Secret Manager: one bundled secret** (free: 6 active versions per billing account; disabled versions count, destroyed don't)
| Item | Value |
|---|---|
| Name | `<SECRET>` |
| Value | `KEY=value` lines (no quotes, no spaces around `=`): every *secret* row of §5 |
| Replication | **Automatic** (billed as one location) |
| Mounted at | `/secrets/backend.env`, with Cloud Run env `ENV_FILE=/secrets/backend.env` |
| Updating | *New version* → **Destroy** the old version → redeploy (instances read the file at start) |

**F. Cloud Build**
| Item | Value |
|---|---|
| Host connection | *Repositories → 2nd gen → Create host connection*: GitHub, region `<GCP_REGION>`, name `github` (its token = 1 secret version) |
| Linked repository | `<GITHUB_ORG>/<REPO>` |
| Trigger | name `backend-main`, region `<GCP_REGION>`, **push to branch** `^main$`, source 2nd gen |
| Included files | `apps/backend/**`, `packages/shared/**`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.dockerignore` |
| Config | Cloud Build configuration file `apps/backend/cloudbuild.yaml` |
| Service account | `<DEPLOYER_SA>@<PROJECT_ID>.iam.gserviceaccount.com` (needs `options.logging: CLOUD_LOGGING_ONLY`) |
| Free tier | 2,500 build-minutes/month on `e2-standard-2`, default pool |

**G. Cloud Run (flags in `apps/backend/cloudbuild.yaml`)**
| Service `<SERVICE>` | Job `<JOB>` (migrations) |
|---|---|
| `--region=<GCP_REGION> --service-account=<RUNTIME_SA>@…` | same region and account |
| `--set-secrets=/secrets/backend.env=<SECRET>:latest --set-env-vars=NODE_ENV=production,ENV_FILE=/secrets/backend.env` | same |
| `--allow-unauthenticated --port=8080 --cpu=1 --memory=512Mi --concurrency=80 --timeout=60` | `--command=node --args=node_modules/typeorm/cli.js,migration:run,-d,dist/config/data-source.js` |
| `--min-instances=0 --max-instances=2 --cpu-throttling --no-cpu-boost` ($0 guardrails) | `--tasks=1 --max-retries=0 --task-timeout=300s --cpu=1 --memory=512Mi --execute-now --wait` |
| Free: 2M requests, 180k vCPU-s, 360k GiB-s/month (request-based) | Free: 240k vCPU-s, 450k GiB-s/month |
Also free: Cloud Logging 50 GiB/month, outbound data 1 GiB/month from North America.

### 4.5 Cloudflare (Step 3, pending)
| Item | Value |
|---|---|
| Account id | Dashboard → right sidebar → `CLOUDFLARE_ACCOUNT_ID` |
| Workers AI token | *My Profile → API Tokens → Create token* with **Workers AI** permission (account-scoped) → `CLOUDFLARE_API_TOKEN` (*secret*) |
| Workers AI model | `WORKERS_AI_MODEL=@cf/meta/llama-3.3-70b-instruct-fp8-fast` (~100 neurons per support triage → ~100/day free); cheaper: `@cf/openai/gpt-oss-20b` (~280/day), `@cf/qwen/qwen3-30b-a3b-fp8` (~600/day) |
| Frontend hosting | **To validate:** Next.js server rendering on **Workers Free (10 ms CPU/request)** via OpenNext. Free fallback if it doesn't fit: run the frontend on Cloud Run as a second service (same free tier) |

### 4.6 Upstash Redis
| Item | Value |
|---|---|
| Database | Region near `<GCP_REGION>` (e.g. N. Virginia) |
| Values | **REST** URL → `UPSTASH_REDIS_REST_URL` · REST token → `UPSTASH_REDIS_REST_TOKEN` (*secret*) |
| Note | Use the REST API (no TCP client or SDK). Optional for Vet Plan (memory fallback) |

### 4.7 Groq
| Item | Value |
|---|---|
| Key | Console → *API Keys* → `GROQ_API_KEY` (*secret*); `GROQ_MODEL=openai/gpt-oss-20b` (strict JSON schema) |
| Privacy | Console → *Data Controls* → enable **Zero Data Retention** if offered |

### 4.8 Telegram
| Item | Value |
|---|---|
| Bot | Chat with **@BotFather** → `/newbot` → token → `TELEGRAM_BOT_TOKEN` (*secret*) |
| Webhook secret | Any 1–256 chars of `A-Z a-z 0-9 _ -` (e.g. `openssl rand -hex 32`) → `TELEGRAM_WEBHOOK_SECRET` (*secret*) |
| Register | After deploying, once, from Cloud Shell (values are typed, not echoed or stored): see the snippet below. Webhook path `/ai-bot/telegram/webhook`. Locally the same call is `pnpm --filter @vet-plan/backend telegram:set-webhook <API_URL>` |

```bash
read -rsp 'Bot token: ' T; echo; read -rsp 'Webhook secret: ' S; echo
curl -s "https://api.telegram.org/bot$T/setWebhook" -H 'Content-Type: application/json' \
  -d "{\"url\":\"<API_URL>/ai-bot/telegram/webhook\",\"secret_token\":\"$S\",\"allowed_updates\":[\"message\"],\"drop_pending_updates\":true}"
unset T S   # expect {"ok":true,...}
```

### 4.9 Axiom
| Item | Value |
|---|---|
| Dataset | create `<APP>-logs` → `AXIOM_DATASET` |
| Token | *Settings → API tokens* with **ingest** permission on that dataset → `AXIOM_TOKEN` (*secret*) |
| Edge domain | from the dataset/organization settings (edge deployment) → `AXIOM_DOMAIN` |

### 4.10 Grafana Cloud
| Item | Value |
|---|---|
| Metrics token | Generate any long random string → `METRICS_TOKEN` (*secret*) |
| Scrape | *Connections → Metrics Endpoint* → URL `<API_URL>/metrics`, auth **Bearer** `METRICS_TOKEN`, interval 60 s |

### 4.11 OAuth providers (social login)
| Provider | Where | Redirect URI | Values |
|---|---|---|---|
| Google | GCP project → *APIs & Services → OAuth consent screen* (External) → *Credentials → OAuth client ID* (Web) | `<API_URL>/auth/oauth/google/callback` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (*secret*) |
| LinkedIn | developer.linkedin.com → app → *Products*: **Sign In with LinkedIn using OpenID Connect** | `<API_URL>/auth/oauth/linkedin/callback` | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` (*secret*) |
| Facebook | developers.facebook.com → app → **Facebook Login** (check app review needs for `email`) | `<API_URL>/auth/oauth/facebook/callback` | `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` (*secret*) |
A provider without both values stays disabled (its button shows "unavailable").

### 4.12 Mobile publishing (the only costs)
Expo Go, development builds and local EAS builds are free. Publishing needs Apple Developer
(**$99/year**) and Google Play (**$25 once**).

---

## 5. Environment variables (backend)

| Key | From | Secret? | Goes to |
|---|---|---|---|
| `DATABASE_URL` | Neon (pooled) | ✔ | `<SECRET>` |
| `DATABASE_MIGRATION_URL` | Neon (direct) | ✔ | `<SECRET>` |
| `JWT_SECRET` | `openssl rand -base64 48` (Cloud Shell) | ✔ | `<SECRET>` |
| `JWT_EXPIRES_IN` | default `86400` | — | `<SECRET>` (optional) |
| `APP_URL` | frontend URL (also the only CORS origin) | — | `<SECRET>` |
| `API_URL` | Cloud Run URL (OAuth callbacks) | — | `<SECRET>` |
| `NODE_ENV`, `ENV_FILE` | fixed | — | Cloud Run env (in `cloudbuild.yaml`) |
| `PORT` | set by Cloud Run (8080) | — | automatic |
| `GOOGLE_* / LINKEDIN_* / FACEBOOK_*` | §4.11 | ✔ (secrets) | `<SECRET>` |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` | §4.8 | ✔ | `<SECRET>` |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `WORKERS_AI_MODEL` | §4.5 | token ✔ | `<SECRET>` |
| `GROQ_API_KEY`, `GROQ_MODEL` | §4.7 | key ✔ | `<SECRET>` |
| `SUPPORT_BOT_RATE_LIMIT_PER_HOUR` | default `10` | — | `<SECRET>` (optional) |
| `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO` | §4.2 | token ✔ | `<SECRET>` |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | §4.6 | token ✔ | `<SECRET>` |
| `METRICS_TOKEN` | §4.10 | ✔ | `<SECRET>` |
| `AXIOM_DOMAIN`, `AXIOM_DATASET`, `AXIOM_TOKEN` | §4.9 | token ✔ | `<SECRET>` |
| `EXPO_PUBLIC_API_URL` | `<API_URL>` | — | mobile build env (public) |

Everything in `<SECRET>` is one file = **one** secret version, whatever the number of keys.

---

## 6. Setup order (and Vet Plan status)

| # | Step | Needs | Vet Plan |
|---|---|---|---|
| 1 | Password manager | — | — |
| 2 | GitHub repo | — | ✅ |
| 3 | Neon project + 2 connection strings | GitHub login | ✅ 2026-10-31 |
| 4 | GCP account, $1 budget, project, setup script, secret, Cloud Build trigger, first deploy → `<API_URL>` | 3 | ⏳ |
| 5 | Cloudflare: frontend → `<APP_URL>`; Workers AI token; update secret (`APP_URL`, `API_URL`) | 4 | ⏳ (account exists) |
| 6 | OAuth apps with `<API_URL>` callbacks; update secret | 4 | ⏳ |
| 7 | Telegram, Groq, GitHub issues token, Upstash, Axiom, Grafana; update secret; register webhook | 4 | ⏳ |
| 8 | CI on pull requests (GitHub Actions) | 2 | ⏳ |

---

## 7. What an app needs in code to follow this playbook
(Vet Plan implements all of it; copy these files.)
- Listens on `PORT` (Cloud Run sets 8080); `GET /health` public.
- Reads config from `ENV_FILE` first, then local `.env` files; existing env vars win
  (`apps/backend/src/app.module.ts`, `apps/backend/src/config/data-source.ts`).
- Migrations via a CLI entry point that uses `DATABASE_MIGRATION_URL` when set.
- `apps/backend/Dockerfile` (monorepo build from root, `pnpm deploy --prod`, non-root) + root `.dockerignore` (no `.env`).
- `apps/backend/cloudbuild.yaml` (build → push → migration job → deploy, guardrail flags).
- `apps/backend/deploy/gcp-setup.sh` (APIs, registry + cleanup, service accounts, secret access).
- Graceful shutdown (`enableShutdownHooks`), JSON logs in production, no background work after a response.
- Optional local stack with no `.env` and no cloud account: `compose.yaml` (Postgres → migration job → API → web)
  plus a dev-only login that needs `DEV_LOGIN_ENABLED=true` and a non-production `NODE_ENV`. Postgres 18+ images
  mount their volume at `/var/lib/postgresql` (not `/data`); bind ports to `127.0.0.1`.

---

## 8. Ongoing $0 checklist
- [ ] Budget alert email received? Check *Billing → Reports* by service.
- [ ] Secret Manager: ≤ 6 active versions in total (destroy old ones).
- [ ] Artifact Registry: ≤ 0.5 GiB (cleanup policy active).
- [ ] Cloud Run: still `min 0 / max 2`, request-based billing, no CPU boost.
- [ ] Neon: compute hours on the project dashboard well under 100 CU-h.
- [ ] Workers AI / Groq: fallback-rate metric (`vetplan_llm_request_duration{outcome}`) not dominated by `rate_limited`.
- [ ] GCP trial day 80: let it close ($0), or add the kill switch and only then *Activate*.

---

## 9. Sources (verified 2026-10-31)
- Neon: [pricing](https://neon.com/pricing) · [regions](https://neon.com/docs/introduction/regions) · [connection pooling](https://neon.com/docs/connect/connection-pooling) · [roles](https://neon.com/docs/manage/roles)
- GCP: [Cloud Run pricing & tiers](https://cloud.google.com/run/pricing) · [Cloud Build pricing](https://cloud.google.com/build/pricing) · [Artifact Registry pricing](https://cloud.google.com/artifact-registry/pricing) · [Secret Manager pricing](https://cloud.google.com/secret-manager/pricing) · [Free Program (trial + free tier)](https://docs.cloud.google.com/free/docs/free-cloud-features) · [Budgets](https://docs.cloud.google.com/billing/docs/how-to/budgets) · [Budget Pub/Sub notifications](https://docs.cloud.google.com/billing/docs/how-to/budgets-programmatic-notifications) · [Disable billing with notifications (kill switch)](https://docs.cloud.google.com/billing/docs/how-to/disable-billing-with-notifications) · [Unlink billing: roles](https://docs.cloud.google.com/billing/docs/how-to/modify-project)
- Cloudflare: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) · [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) · [Workers AI data usage](https://developers.cloudflare.com/workers-ai/platform/data-usage/) · [OpenAI-compatible API](https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/)
- GitHub: [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- Upstash: [Redis pricing](https://upstash.com/pricing/redis) · Groq: [rate limits](https://console.groq.com/docs/rate-limits), [your data](https://console.groq.com/docs/your-data)
- Axiom: [pricing](https://axiom.co/pricing), [ingest API](https://axiom.co/docs/send-data/ingest) · Grafana: [pricing](https://grafana.com/pricing/)
- Telegram: [Bot API (setWebhook secret_token)](https://core.telegram.org/bots/api) · Gemini: [API terms (why not used)](https://ai.google.dev/gemini-api/terms)
