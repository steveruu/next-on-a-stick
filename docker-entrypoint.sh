#!/bin/sh
set -e

# /data is the only writable place
mkdir -p /data/.next

########################################
# 1. Copy runtime server bundle on first boot
########################################
if [ ! -f /data/server.js ]; then
  echo "[init] First run on this volume: bootstrapping /data ..."

  # Copy the standalone server bundle (server.js + minimal node_modules + .next/server code)
  if [ -d "/app/standalone" ]; then
    cp -r /app/standalone/. /data/
  else
    echo "[init] ERROR: /app/standalone missing"
    exit 1
  fi

  # Public assets (Next serves /public directly)
  if [ -d "/app/public" ]; then
    cp -r /app/public /data/
  fi

  # Prisma schema/migrations/etc
  if [ -d "/app/prisma" ]; then
    cp -r /app/prisma /data/
  fi

  # If the pruned standalone node_modules is missing Prisma engines,
  # patch them in from backup.
  if [ -d "/app/node_modules" ] && [ ! -d "/data/node_modules/next" ]; then
    # fallback: copy full node_modules if standalone was missing stuff
    cp -r /app/node_modules /data/
  elif [ -d "/app/node_modules/.prisma" ]; then
    # lighter fallback: just prisma runtime bits
    mkdir -p /data/node_modules
    cp -r /app/node_modules/.prisma /data/node_modules/ 2>/dev/null || true
    cp -r /app/node_modules/prisma /data/node_modules/ 2>/dev/null || true
    cp -r /app/node_modules/@prisma /data/node_modules/ 2>/dev/null || true
    mkdir -p /data/node_modules/.bin
    cp /app/node_modules/.bin/prisma /data/node_modules/.bin/ 2>/dev/null || true
  fi
fi

########################################
# 2. Always sync static client assets
#    (JS chunks, CSS, fonts)
########################################
# We ALWAYS refresh .next/static and BUILD_ID from the image.
# Why? So server.js and static assets are guaranteed to match.
if [ -d "/app/next_build" ]; then
  echo "[init] Syncing Next.js static assets into /data/.next ..."
  mkdir -p /data/.next

  # Copy static assets that the browser will request at /_next/static/*
  rm -rf /data/.next/static
  cp -r /app/next_build/static /data/.next/

  # Copy BUILD_ID used for cache-busting
  cp /app/next_build/BUILD_ID /data/.next/BUILD_ID
else
  echo "[init] WARNING: /app/next_build not found, cannot sync static assets"
fi

########################################
# 3. Sanity checks
########################################
if [ ! -f /data/server.js ]; then
  echo "[init] ERROR: /data/server.js not found after bootstrap"
  exit 1
fi

if [ ! -f /data/.next/BUILD_ID ]; then
  echo "[init] ERROR: /data/.next/BUILD_ID not found after bootstrap"
  exit 1
fi

echo "[init] Startup OK. Launching app..."

########################################
# 4. Start the Next.js server
########################################
exec "$@"