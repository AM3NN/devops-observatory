FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY lib/ lib/
COPY artifacts/ artifacts/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @devops-observatory/api-server build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/artifacts/api-server/dist/ /app/dist/
COPY --from=builder /app/artifacts/api-server/package.json /app/
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/index.mjs"]
