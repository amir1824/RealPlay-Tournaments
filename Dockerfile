# One image, two processes: the API and the workers app share the build and
# differ only in the command (see docker-compose.yml, profile "app").

FROM node:20-bookworm-slim AS build
# Prisma's query engine links against OpenSSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* && corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
# The schema must be present before install: @prisma/client generates on postinstall.
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM build AS prod-deps
# The client was generated at install; the root postinstall would need the
# prisma CLI, which prune removes.
RUN pnpm prune --prod --ignore-scripts

FROM node:20-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./
USER node
EXPOSE 3000
CMD ["node", "dist/apps/api/main.js"]
