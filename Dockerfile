# -----------------------------------------
# Full Dockerfile — drop-in replacement
# -----------------------------------------
# Use official Node.js runtime as base image
FROM node:18-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ---------- deps stage ----------
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# ---------- builder stage ----------
FROM base AS builder

# allow providing DATABASE_URL at build time to satisfy Prisma during build
ARG DATABASE_URL="file:/data/database.db"
ENV DATABASE_URL=${DATABASE_URL}
WORKDIR /app

# copy deps from deps stage
COPY --from=deps /app/node_modules ./node_modules

# copy app sources
COPY . .

# generate prisma client (will use DATABASE_URL if needed)
RUN npx prisma generate

# build the app (Turbopack or webpack per your config)
RUN npm run build \
  && echo "=== BUILD: show .next root ===" \
  && ls -la /app/.next || true \
  && echo "=== BUILD: show .next/server (if present) ===" \
  && ls -la /app/.next/server || true \
  && echo "=== BUILD: check pages-manifest.json presence ===" \
  && if [ -f /app/.next/server/pages-manifest.json ]; then echo "pages-manifest.json: PRESENT"; else echo "pages-manifest.json: MISSING"; fi

# ---------- runner stage ----------
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install only production dependencies
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# Create non-root user/group
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Copy public + standalone + static from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Prepare writable /data paths and set ownership
RUN mkdir -p /data/next-cache /data/next-server \
 && chown -R nextjs:nodejs /data

# CRITICAL: copy server build output from builder into writable /data
# this ensures all server files (pages-manifest.json, chunks, pages) are present
COPY --from=builder --chown=nextjs:nodejs /app/.next/server /data/next-server

# Create .next folder and symlink server & cache into /data
RUN mkdir -p .next \
 && rm -rf .next/cache .next/server \
 && ln -sf /data/next-cache .next/cache \
 && ln -sf /data/next-server .next/server

# Ensure non-root user owns .next and /data
RUN chown -R nextjs:nodejs /app/.next /data

# Copy Prisma runtime artifacts if needed
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
# -----------------------------------------
