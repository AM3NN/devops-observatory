FROM node:20-slim AS builder
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY lib/ lib/
COPY artifacts/ artifacts/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @devops-observatory/api-server build

FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/artifacts/api-server/dist/ /app/dist/
COPY --from=builder /app/node_modules/ /app/node_modules/
RUN mkdir -p /home/LogFiles
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'node /app/dist/index.mjs 2>/home/LogFiles/crash.log' >> /app/start.sh && \
    echo 'cat /home/LogFiles/crash.log' >> /app/start.sh && \
    echo 'sleep 9999' >> /app/start.sh && \
    chmod +x /app/start.sh
ENV PORT=8080
EXPOSE 8080
CMD ["/app/start.sh"]
