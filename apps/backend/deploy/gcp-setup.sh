#!/usr/bin/env bash
# One-time GCP setup for the Vet Plan backend (docs/DEPLOYMENT.md, Step 2 · Part B).
# Paste into Cloud Shell (console.cloud.google.com → >_ icon) with the vet-plan project selected.
# Safe to re-run. Creates nothing billable outside the free tier.
set -euo pipefail

PROJECT_ID="$(gcloud config get-value project 2>/dev/null)"
REGION=us-east4
REPOSITORY=vet-plan
SECRET=vet-plan-backend-env
RUNTIME_SA="vet-plan-backend@${PROJECT_ID}.iam.gserviceaccount.com"
DEPLOYER_SA="vet-plan-deployer@${PROJECT_ID}.iam.gserviceaccount.com"

if [ -z "$PROJECT_ID" ]; then
  echo "No project selected. Run: gcloud config set project <your-project-id>" >&2
  exit 1
fi
echo "Project: $PROJECT_ID · Region: $REGION"

echo "1/5 Enabling APIs (Cloud Run, Cloud Build, Artifact Registry, Secret Manager, IAM)…"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com iam.googleapis.com cloudresourcemanager.googleapis.com

echo "2/5 Image repository with cleanup (keep the 2 newest images: 0.5 GiB free tier)…"
gcloud artifacts repositories describe "$REPOSITORY" --location="$REGION" >/dev/null 2>&1 ||
  gcloud artifacts repositories create "$REPOSITORY" --repository-format=docker --location="$REGION" \
    --description="Vet Plan container images"
cat > /tmp/vet-plan-cleanup.json <<'JSON'
[
  { "name": "keep-2-newest", "action": { "type": "Keep" }, "mostRecentVersions": { "keepCount": 2 } },
  { "name": "delete-older", "action": { "type": "Delete" }, "condition": { "tagState": "any", "olderThan": "1d" } }
]
JSON
gcloud artifacts repositories set-cleanup-policies "$REPOSITORY" --location="$REGION" \
  --policy=/tmp/vet-plan-cleanup.json --no-dry-run --quiet >/dev/null

echo "3/5 Service accounts (runtime: vet-plan-backend · Cloud Build: vet-plan-deployer)…"
for sa in vet-plan-backend vet-plan-deployer; do
  gcloud iam service-accounts describe "${sa}@${PROJECT_ID}.iam.gserviceaccount.com" >/dev/null 2>&1 ||
    gcloud iam service-accounts create "$sa" --display-name="$sa"
done

echo "4/5 Deployer permissions (deploy Cloud Run, push images, write build logs, act as runtime)…"
for role in roles/run.admin roles/artifactregistry.writer roles/logging.logWriter; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:${DEPLOYER_SA}" \
    --role="$role" --condition=None --quiet >/dev/null
done
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="serviceAccount:${DEPLOYER_SA}" --role=roles/iam.serviceAccountUser --quiet >/dev/null

echo "5/5 Secret access for the runtime account…"
if gcloud secrets describe "$SECRET" >/dev/null 2>&1; then
  gcloud secrets add-iam-policy-binding "$SECRET" --member="serviceAccount:${RUNTIME_SA}" \
    --role=roles/secretmanager.secretAccessor --quiet >/dev/null
  echo "    granted on $SECRET"
else
  echo "    secret '$SECRET' doesn't exist yet: create it (Part C), then run this script again."
fi
echo "Done."
