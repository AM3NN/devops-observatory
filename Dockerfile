FROM node:20-slim AS builder
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.base.json tsconfig.json ./
COPY lib/ lib/
COPY artifacts/ artifacts/
RUN pnpm install --frozen-lockfile
RUN mkdir -p /app/artifacts/devops-observatory/dist/public
COPY artifacts/devops-observatory/dist/public/ /app/artifacts/devops-observatory/dist/public/
RUN pnpm --filter @devops-observatory/api-server build

FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/artifacts/api-server/dist/ /app/dist/
ENV PORT=8080
EXPOSE 8080
CMD ["node", "/app/dist/index.mjs"]
