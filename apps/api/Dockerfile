FROM node:22-bookworm-slim

WORKDIR /workspace

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile=false
RUN pnpm -r --filter @evu/kb-api... build

EXPOSE 4201

CMD ["pnpm", "--filter", "@evu/kb-api", "start"]
