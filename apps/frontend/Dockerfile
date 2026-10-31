# Web app image for the local Docker stack (compose.yaml), built from the repo root:
#   docker compose up --build
# Production hosting is Cloudflare (docs/DEPLOYMENT.md, Step 3). No .env enters the image
# (apps/frontend/Dockerfile.dockerignore); runtime settings come from compose.yaml.
FROM node:24.22.0-slim
ENV CI=true \
    NEXT_TELEMETRY_DISABLED=1
RUN npm install --global pnpm@11.26.0 && mkdir /repo && chown node:node /repo
USER node
WORKDIR /repo

COPY --chown=node:node . .
RUN pnpm install --frozen-lockfile --filter "@vet-plan/frontend..."

# The login page's provider links are prerendered, so the browser-facing backend URL is a build input
ARG PUBLIC_API_URL=http://localhost:4000
ENV PUBLIC_API_URL=${PUBLIC_API_URL}
RUN pnpm --filter "@vet-plan/frontend..." build

ENV NODE_ENV=production
WORKDIR /repo/apps/frontend
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "--port", "3000"]
