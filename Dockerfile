# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS build

ARG PNPM_VERSION=11.9.0
ARG VITE_API_BASE_URL=/api/v1

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN corepack enable \
    && corepack prepare "pnpm@${PNPM_VERSION}" --activate \
    && apt-get update \
    && apt-get install --yes --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .
RUN pnpm build && pnpm prune --prod


FROM node:24-bookworm-slim AS runtime

LABEL org.opencontainers.image.title="International Chinese Platform" \
      org.opencontainers.image.description="Self-contained international Chinese education platform" \
      org.opencontainers.image.source="https://github.com/computersciencefreshmen/International_Chinese_Platform"

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=7777 \
    DATABASE_PATH=/app/data/platform.db \
    UPLOAD_DIR=/app/uploads \
    DIST_DIR=/app/dist \
    SEED_ON_START=false

RUN groupadd --system --gid 10001 platform \
    && useradd --system --uid 10001 --gid platform --home-dir /app --shell /usr/sbin/nologin platform \
    && mkdir -p /app/data /app/uploads \
    && chown -R platform:platform /app

WORKDIR /app

COPY --from=build --chown=platform:platform /app/package.json ./package.json
COPY --from=build --chown=platform:platform /app/node_modules ./node_modules
COPY --from=build --chown=platform:platform /app/server ./server
COPY --from=build --chown=platform:platform /app/dist ./dist

USER 10001:10001

EXPOSE 7777
VOLUME ["/app/data", "/app/uploads"]
STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:7777/api/v1/ready').then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"]

CMD ["node", "server/index.js"]
