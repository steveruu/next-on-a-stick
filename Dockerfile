# Use official Node.js runtime as base image
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
# Install all dependencies including devDependencies for build process
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma client
RUN npx prisma generate

# Build application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install only production dependencies for runtime
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# Create nextjs user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the standalone build
COPY --from=builder /app/public ./public

# Copy Prisma schema and generated client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# No custom cache handler needed - using symlinks instead

# Create minimal .next directory structure for Next.js
RUN mkdir -p .next && chown nextjs:nodejs .next

# Create /data directory for writable storage and cache first
RUN mkdir -p /data/next-cache && chown -R nextjs:nodejs /data

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Create symlink for cache only (not entire server directory)
RUN rm -rf .next/cache && ln -sf /data/next-cache .next/cache

# Create writable directory for server app cache (where prerender cache goes)
RUN mkdir -p /data/server-app && chown -R nextjs:nodejs /data/server-app

# Only symlink the app cache directory (not the entire server directory)
# This preserves essential files like pages-manifest.json while making cache writable
RUN mkdir -p .next/server
RUN if [ -d .next/server/app ]; then rm -rf .next/server/app; fi
RUN ln -sf /data/server-app .next/server/app

# Ensure proper ownership
RUN chown -R nextjs:nodejs /data

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start Next.js directly (directories already created above)
CMD ["node", "server.js"]
