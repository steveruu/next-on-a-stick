# syntax=docker.io/docker/dockerfile:1

FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .npmrc* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi


# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
# ENV NEXT_TELEMETRY_DISABLED=1

RUN \
  if [ -f yarn.lock ]; then yarn run build; \
  elif [ -f package-lock.json ]; then npm run build; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Create a writable directory for dynamic data, and give 'nextjs' user ownership.
RUN mkdir -p /data/.next && chown -R nextjs:nodejs /data

COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# Copy the standalone files, but exclude any .next subdirectory to avoid read-only conflicts
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./standalone_temp
# Move only the files we need, avoiding the .next subdirectory
RUN if [ -f "./standalone_temp/server.js" ]; then mv ./standalone_temp/server.js ./; fi
RUN if [ -f "./standalone_temp/package.json" ]; then mv ./standalone_temp/package.json ./; fi  
# Copy other files but not .next directory
RUN find ./standalone_temp -maxdepth 1 -type f -not -name ".*" -exec mv {} ./ \;
# Clean up temp directory
RUN rm -rf ./standalone_temp

# Copy the complete .next directory for staging in a different location
COPY --from=builder --chown=nextjs:nodejs /app/.next ./next_build/

# The standalone output might not include the prisma CLI and its engine, so we copy it over manually.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
# And the executable itself
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

ENV PORT=8080
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:/data/database.db"

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER nextjs

# The server will run from /data (writable directory) instead of /app (read-only)
WORKDIR /data

EXPOSE 8080

ENTRYPOINT ["docker-entrypoint.sh"]

# server.js will be copied to /data by the entrypoint script
# https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
CMD ["node", "server.js"]
