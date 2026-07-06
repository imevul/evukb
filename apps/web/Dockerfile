FROM node:22-bookworm-slim

WORKDIR /workspace

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile=false
RUN pnpm -r --filter @evu/kb-web... build

EXPOSE 4200

ENV EVUKB_API_PROXY_TARGET=http://evukb-api:4201

RUN chmod +x scripts/write-web-runtime-config.sh

CMD ["scripts/write-web-runtime-config.sh"]
