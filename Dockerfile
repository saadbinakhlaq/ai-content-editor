# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat

# Install dependencies once
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# Build Next.js app
FROM deps AS builder
COPY prisma ./prisma

RUN npx prisma generate
COPY . .
RUN npm run build

# Production web image using Next standalone output
FROM base AS web
ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]

# Worker image with full source + node_modules
FROM deps AS worker
ENV NODE_ENV=production
WORKDIR /app

COPY prisma ./prisma
RUN npx prisma generate
COPY . .

CMD ["npm", "run", "worker"]

# Migration image
FROM deps AS migrate
ENV NODE_ENV=production
WORKDIR /app

COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate

CMD ["npx", "prisma", "migrate", "deploy"]