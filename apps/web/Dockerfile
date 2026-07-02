FROM node:22-bookworm-slim

WORKDIR /workspace

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile=false

ARG VITE_EVUKB_API_BASE_URL=
ENV VITE_EVUKB_API_BASE_URL=${VITE_EVUKB_API_BASE_URL}

RUN pnpm -r --filter @evu/kb-web... build

EXPOSE 4200

ENV EVUKB_API_PROXY_TARGET=http://evukb-api:4201

CMD ["pnpm", "--filter", "@evu/kb-web", "preview", "--host", "0.0.0.0", "--port", "4200"]
