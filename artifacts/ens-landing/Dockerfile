FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY artifacts/ens-landing/package.json ./artifacts/ens-landing/
COPY lib/api-zod/package.json ./lib/api-zod/
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY lib/api-zod/ ./lib/api-zod/
COPY artifacts/ens-landing/ ./artifacts/ens-landing/
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN pnpm --filter @workspace/api-zod build
RUN pnpm --filter @workspace/ens-landing build

FROM nginx:stable-alpine AS runner
COPY --from=builder /app/artifacts/ens-landing/dist/public /usr/share/nginx/html
COPY artifacts/ens-landing/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/health.txt || exit 1

CMD ["nginx", "-g", "daemon off;"]
