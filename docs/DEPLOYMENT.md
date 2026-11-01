# VetPlan — Deployment ($0 / free tier)

Everything runs in the cloud: nothing is built or run on a developer machine. Images are built by
Cloud Build from GitHub, configuration lives in GCP Secret Manager, and migrations run as a Cloud Run job.
To reuse this setup in other apps (every account, value and parameter), see
[`ZERO COST - INFRASTRUCTURE AND DATABASE.md`](ZERO%20COST%20-%20INFRASTRUCTURE%20AND%20DATABASE.md).

| Piece | Where | Free tier used |
|---|---|---|
| Database | Neon, project `vet-plan`, **AWS us-east-1 (N. Virginia)** | Free plan: 1 GB, 100 CU-hours/month, scale to zero |
| Backend API | Cloud Run service `vet-plan-api`, **us-east4 (N. Virginia, Tier 1)** | 2M requests, 180k vCPU-s, 360k GiB-s/month (request-based) |
| Migrations | Cloud Run job `vet-plan-migrate` (same image) | Jobs: 240k vCPU-s/month |
| Builds | Cloud Build trigger → `apps/backend/cloudbuild.yaml` | 2,500 build-minutes/month (e2-standard-2, default pool) |
| Images | Artifact Registry `vet-plan` (us-east4), cleanup keeps 2 newest | 0.5 GiB storage |
| Configuration | Secret Manager `vet-plan-backend-env` (one env file, automatic replication) | 6 active secret versions, 10k accesses/month |
| Logs | Cloud Logging (stdout JSON) | 50 GiB/month |

The database and API sit in the same Ashburn (Virginia) area, so each query is a few milliseconds.

---

## Step 1: Neon (done 2026-10-31)
Project `vet-plan` in AWS us-east-1, Postgres 18, branch `production`, database `neondb`, role
`neondb_owner`, no add-ons. Two connection strings are kept in a password manager:
- **pooled** (host contains `-pooler`) → `DATABASE_URL` (the app; PgBouncer transaction mode)
- **direct** (no `-pooler`) → `DATABASE_MIGRATION_URL` (migrations only)

## Step 2: GCP backend

### Part A: Account, billing, budget, project (console), strict $0
**Why this costs $0.** The Free Trial can't charge you: Google says *"You will not be billed for any
Google Cloud usage during your Free Trial"* and *"No automatic charges"*. If the $300 credit runs out or
90 days pass, the trial billing account closes and its resources stop, and nothing is billed. Charges
become possible only if you click **Activate** (upgrade). The Free Tier applies during the trial and
doesn't use the credit, so this setup should spend none of it. Cloud Run, Cloud Build and Artifact
Registry need a billing account even when usage stays free; the trial billing account is that account.

1. **Sign up for the Free Trial.** Use the one Google account that will own everything (free-tier limits
   are counted per billing account). Go to https://console.cloud.google.com → accept the terms → **Start free**.
   - You're eligible only if you never paid for Google Cloud, Google Maps Platform or Firebase and never had a trial.
   - **Profile type** (*Tipo de perfil*, *Confirme sua identidade*): it **can't be changed after signup**.
     - If a company will own and pay for the product, choose **Organization** (*Organização*: company name,
       CNPJ/tax id, address). A personal card is fine. Google's FAQ: *"A corporate credit card is not required
       to start the Google Cloud Free Trial. You can use your personal credit card to verify your identity,
       without being personally responsible for any payment"*. Switch to a company payment method before ever
       clicking *Activate*. Organization profiles can also add more users; Individual profiles can't.
     - Choose **Individual** (*Pessoa física*) only if you will own and pay for it personally. Moving to a
       company later means a **new** billing account under an Organization profile, with the project re-linked
       (*Billing → My projects → Change billing*, no downtime). The $300 trial stays with the old account, so
       the new one is paid from day one and needs the kill switch first.
   - Enter the card (prepaid and virtual cards are refused); Google uses it only for identity and fraud checks.
     A pending **$0–$1 authorization hold** may appear. It isn't a charge and is released within a few days
     (at most about a month).
   - **Brazil (and some other countries): one-time prepayment** (*Pré-pagamento único*, **R$ 150** in
     2026-11). It's a real charge on the card, credited as a balance on the billing account, so it's a deposit,
     not a fee. Google: *"Prepayments to a Postpay Google payments account will be refunded if unused by the time
     of account closure."* The trial and the free tier don't consume it, and it's refunded when the account
     closes (e.g. the trial ends unupgraded). Keep the receipt; if no refund arrives, contact Cloud Billing
     support (free). It isn't the AI Studio *Prepay* credit, which is non-refundable.
   - This creates the trial billing account *My Billing Account* and an empty project *My First Project*
     (costs nothing; optionally shut it down in *IAM & Admin → Settings*).
2. **Budget alert (early warning):** ☰ → *Billing* → *Budgets & alerts* → *Create budget*:
   - Name `vet-plan-zero`, time range **Monthly**, projects **All**, services **All**.
   - Savings: **untick "Promotional credits"** (the $300 trial credit would otherwise hide real spending) and
     **keep "Free tier credits" ticked** (free usage must count as $0). All savings are ticked by default.
   - Amount: **Specified amount**, 1 USD or the equivalent in your billing currency (Brazil: **R$ 5**).
   - Thresholds: 50 %, 90 %, 100 % **Actual** and 100 % **Forecasted**. Keep *Email billing admins and users* on.
   - Any alert email means something is costing money beyond the free tier: open *Billing → Reports*,
     group by service, and fix it. Budgets only alert; they don't stop spending.
3. **Project:** project picker → *New project* → name `vet-plan` (note the **Project ID**, e.g.
   `vet-plan-123456`) → *Create* → select it. *Billing → Account management* should list it under the
   trial billing account.
4. **Don't click "Activate" or "Upgrade"** (Welcome page or top banner) during the trial. It's the only step
   that allows charges. See [GCP free trial end](#gcp-free-trial-end-decide-by-day-80) before you ever do.

### Part B: One-time setup script (Cloud Shell)
5. Click the **Cloud Shell** icon (`>_`, top right). If asked, *Authorize*.
6. Check the project: `gcloud config get-value project` (if empty: `gcloud config set project <PROJECT_ID>`).
7. Save the script as a file and run it (pasting it straight into the prompt would close Cloud Shell on
   any error): `nano gcp-setup.sh` → paste the contents of
   [`apps/backend/deploy/gcp-setup.sh`](../apps/backend/deploy/gcp-setup.sh) → `Ctrl+O`, `Enter`, `Ctrl+X`
   → `bash gcp-setup.sh`. It enables the APIs, creates the image repository + cleanup policy, and the two service
   accounts: `vet-plan-backend` (runtime) and `vet-plan-deployer` (Cloud Build). The first API enable can
   take a minute. The last line says the secret doesn't exist yet: expected.

### Part C: The configuration secret (console + Cloud Shell)
8. Generate the JWT key in Cloud Shell: `openssl rand -base64 48 | tr -d '\n'; echo` (copy the output).
9. ☰ → *Security* → *Secret Manager* → *Create secret*:
   - Name: `vet-plan-backend-env`
   - Secret value (paste, one `KEY=value` per line, no quotes, no spaces around `=`):
     ```
     DATABASE_URL=<Neon pooled string>
     DATABASE_MIGRATION_URL=<Neon direct string>
     JWT_SECRET=<output of step 8>
     APP_URL=http://localhost:3000
     ```
     (`APP_URL` is a placeholder until the frontend is deployed in Step 3.)
   - Replication: **Automatic** (billed as one location). Leave rotation/expiration off. *Create secret*.
10. Back in Cloud Shell, run `bash gcp-setup.sh` again. The last line now says `granted on vet-plan-backend-env`.

### Part D: Connect GitHub and create the trigger (console)
11. ☰ → *Cloud Build* → *Repositories* → **2nd gen** tab → *Create host connection*:
    provider **GitHub**, region **us-east4**, name `github` → *Connect*. If prompted, grant the Cloud Build
    service agent the Secret Manager role (it stores the GitHub token as one secret version).
    Authorize the *Google Cloud Build* GitHub app and install it **only on `VetPlan-Admin/monorepo`**.
12. *Link repository* → connection `github` → select `VetPlan-Admin/monorepo` → *Link*.
13. *Cloud Build* → *Triggers* → region **us-east4** → *Create trigger*:
    - Name `backend-main`; Event **Push to a branch**; Source **2nd gen**, repository `monorepo`, branch `^main$`
    - *Included files filter* (build only when the backend can change): `apps/backend/**`,
      `packages/shared/**`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.dockerignore`
    - Configuration: **Cloud Build configuration file**, location `apps/backend/cloudbuild.yaml`
    - Service account: **`vet-plan-deployer@<PROJECT_ID>.iam.gserviceaccount.com`** → *Create*.

### Part E: First deploy and check
14. On the trigger row, click **Run** (branch `main`). Watch *History*: build → push → migrate → deploy
    (~4–6 minutes). The `migrate` step runs both migrations against Neon.
15. ☰ → *Cloud Run* → `vet-plan-api` → copy the **URL** (`https://vet-plan-api-….us-east4.run.app`).
    Open `<URL>/health` → `{"status":"ok"}`. `<URL>/cases` → 401 (login required). `<URL>/metrics` → 404
    (no `METRICS_TOKEN` yet). `<URL>/auth/dev/roles` → 404 (dev login is always off in production).
    From now on, every push to `main` touching the backend redeploys automatically.

---

## GCP free trial end (decide by day 80)
The trial ends 90 days after signup. Put a calendar reminder for day 80.
- **Let it close (stays $0):** the billing account closes and every resource stops. After a 30-day grace
  period, when you can still upgrade, Google deletes the resources. Nothing is lost that can't be rebuilt:
  code is in GitHub, data in Neon, secret values in the password manager.
- **Keep it running:** first add a **billing kill switch** (ROADMAP Phase 7), then click *Activate*.
  - How it works: the `vet-plan-zero` budget publishes to a Pub/Sub topic, and a small function unlinks
    billing from the project when cost passes the budget. It needs *Project Billing Manager* (+ Browser)
    on the project.
  - Limits: Google sends budget notifications several times a day and the first one can take hours, so it
    caps a runaway at a few hours of usage rather than exactly $0. Requests beyond 2 million/month cost
    $0.40 per million, which is what a bot flood would run up.
  - Side effect: unlinking stops every service, free ones too, and *"resources might be irretrievably
    deleted"*. Recovery: re-link billing, re-run `gcp-setup.sh`, re-create the secret, run the trigger.

## Changing configuration
1. *Secret Manager* → `vet-plan-backend-env` → **New version** → paste the full file with the change → *Add*.
2. **Destroy** the previous version (⋮ → *Destroy*): disabled versions still count toward the 6 free ones.
3. Redeploy so instances re-read the file: *Cloud Build* → *Triggers* → `backend-main` → **Run**
   (or *Cloud Run* → `vet-plan-api` → *Edit & deploy new revision* → *Deploy*).

## Rolling back
*Cloud Run* → `vet-plan-api` → *Revisions* → previous revision → *Manage traffic* → 100 %. Migrations
aren't rolled back automatically; write a new migration instead of editing an applied one.

## Free-tier guardrails (strict $0)
- Cloud Run: `--min-instances=0`, `--max-instances=2`, `--cpu-throttling` (CPU billed only while handling
  requests), `--no-cpu-boost`, 1 vCPU / 512 MiB, 60 s timeout. Raising instances, memory or `min-instances`
  can leave the free tier. Review the budget first.
- Builds only on backend changes (included-files filter); ~3–5 build-minutes each.
- Artifact Registry keeps 2 images (cleanup policy). One image ≈ 120–150 MB compressed.
- Secret Manager: one secret + the GitHub connection's token = 2 of 6 free versions; destroy old versions.
- Never add: Cloud SQL, load balancers, Cloud NAT, VPC connectors, Cloud Armor, Memorystore (all paid).
- Never put `DEV_LOGIN_ENABLED` in `vet-plan-backend-env`. The API ignores it under `NODE_ENV=production`, but it belongs only to `compose.yaml` (local).
- Outbound data from North America: 1 GiB/month free. API responses are small; images never leave the browser.
- **Free trial:** never click *Activate* until the kill switch exists ([GCP free trial end](#gcp-free-trial-end-decide-by-day-80)).

## Next steps
- Step 3: Cloudflare (frontend hosting + Workers AI token), then set `APP_URL` and `API_URL`.
- Step 4: Google OAuth client (callback `https://<API URL>/auth/oauth/google/callback`).
- Step 5: Bot and observability keys (Telegram, Groq, GitHub issues token, Upstash, `METRICS_TOKEN`, Axiom).
