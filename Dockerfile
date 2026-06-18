FROM node:20-slim AS builder
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY lib/ lib/
COPY artifacts/ artifacts/
RUN pnpm install --frozen-lockfile

FROM builder AS frontend-builder
ENV VITE_API_BASE_URL=""
ENV TAILWIND_DISABLE_OXIDE=true
RUN pnpm --filter @devops-observatory/web build

FROM builder AS api-builder
COPY --from=frontend-builder /app/artifacts/devops-observatory/dist/public/ /app/artifacts/devops-observatory/dist/public/
RUN pnpm --filter @devops-observatory/api-server build

FROM node:20-slim
WORKDIR /app
COPY --from=api-builder /app/artifacts/api-server/dist/ /app/dist/
ENV PORT=8080
EXPOSE 8080
CMD ["node", "/app/dist/index.mjs"]
