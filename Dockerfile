# syntax=docker/dockerfile:1

# This is a Bun project (bun.lock, `bun src/cli/index.ts`), so it runs on the
# official Bun image rather than Node + npm.
ARG BUN_VERSION=1.3.14

FROM oven/bun:${BUN_VERSION}-alpine

ENV NODE_ENV=production

WORKDIR /usr/src/app

# Install runtime dependencies first so this layer is cached until the
# manifest or lockfile changes.
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production

COPY . .

# Run as the non-root user that ships with the Bun image.
USER bun

# The CLI is an interactive menu, not a server: run it with a TTY
# (`docker compose run --rm cli` or `docker run -it`).
ENTRYPOINT ["bun", "run", "cli"]
