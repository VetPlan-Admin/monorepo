# Backend image for Cloud Run, built by Cloud Build from the MONOREPO ROOT (docs/DEPLOYMENT.md):
#   docker build -f apps/backend/Dockerfile .
# Stage 1 installs and builds only @vet-plan/backend and its workspace dependencies
# (@vet-plan/shared). Stage 2 keeps the production bundle from `pnpm deploy`: no dev
# dependencies, no other apps, small enough for Artifact Registry's 0.5 GiB free tier.
FROM node:24.22.0-slim AS build
ENV CI=true
RUN npm install --global pnpm@11.26.0
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter "@vet-plan/backend..."
RUN pnpm --filter "@vet-plan/backend..." build
RUN pnpm --filter @vet-plan/backend deploy --prod /out

FROM node:24.22.0-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/package.json ./package.json
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /out/dist ./dist
USER node
# Cloud Run sets PORT (8080). The same image runs the migration job with:
#   node node_modules/typeorm/cli.js migration:run -d dist/config/data-source.js
EXPOSE 8080
CMD ["node", "dist/main.js"]
