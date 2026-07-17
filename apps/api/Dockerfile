# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS base
WORKDIR /workspace
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# Dependency manifests only — cached across ordinary source edits.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/kb-core/package.json packages/kb-core/
COPY packages/kb-db/package.json packages/kb-db/
COPY packages/kb-server/package.json packages/kb-server/
COPY packages/kb-sdk/package.json packages/kb-sdk/
COPY packages/kb-ui/package.json packages/kb-ui/
COPY examples/custom-ranking-strategy/package.json examples/custom-ranking-strategy/
RUN --mount=type=cache,id=evukb-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
RUN pnpm -r --filter @evu/kb-api... build

# Production runtime: built artifacts + workspace + debug toolkit.
FROM ${NODE_IMAGE} AS runtime
WORKDIR /workspace
ENV NODE_ENV=production \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      bash \
      curl \
      vim-tiny \
      iproute2 \
      iputils-ping \
      netcat-openbsd \
      dnsutils \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable \
    && corepack prepare pnpm@10.33.0 --activate

COPY --from=builder --chown=node:node /workspace /workspace
RUN mkdir -p /data/corpus-store && chown -R node:node /data/corpus-store

USER node
EXPOSE 4201
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:4201/health || exit 1
CMD ["pnpm", "--filter", "@evu/kb-api", "start"]

# Dev image: deps + toolkit; compose bind-mounts source over /workspace.
FROM deps AS dev
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      bash \
      curl \
      vim-tiny \
      ca-certificates \
      git \
    && rm -rf /var/lib/apt/lists/*
EXPOSE 4201
CMD ["pnpm", "--filter", "@evu/kb-api", "dev"]
