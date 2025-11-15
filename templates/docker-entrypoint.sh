#!/bin/sh
set -e

# /data is the only writable place

echo "[DEBUG] Starting entrypoint script..."
echo "[DEBUG] Contents of /app/next_build:"
ls -la /app/next_build/ || echo "ERROR: /app/next_build not found"
echo "[DEBUG] Contents of /app/next_build/static:"
ls -la /app/next_build/static/ || echo "ERROR: /app/next_build/static not found"

# ALWAYS sync static assets every start
mkdir -p /data/.next
rm -rf /data/.next/static
cp -r /app/next_build/static /data/.next/
cp /app/next_build/BUILD_ID /data/.next/BUILD_ID

echo "[DEBUG] BUILD_ID contents:"
cat /data/.next/BUILD_ID
echo ""
echo "[DEBUG] Contents of /data/.next/static after copy:"
ls -la /data/.next/static/ || echo "ERROR: /data/.next/static not found after copy"
echo "[DEBUG] Contents of /data/.next/static/chunks:"
ls -la /data/.next/static/chunks/ || echo "No chunks directory"
echo "[DEBUG] Contents of /data/.next/static/mG-TVzzLFszL5cHRFQidp:"
ls -la /data/.next/static/mG-TVzzLFszL5cHRFQidp/ || echo "No BUILD_ID directory"


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

  # Copy Prisma client from image - standalone might not include it
  if [ -d "/app/node_modules/.prisma" ]; then
    mkdir -p /data/node_modules
    cp -r /app/node_modules/.prisma /data/node_modules/
    cp -r /app/node_modules/@prisma /data/node_modules/
  fi

  echo "[init] Running database migrations (first boot)..."
  cd /data
  prisma migrate deploy || prisma db push
  
  echo "[init] Seeding database (first boot)..."
  # For seeding, we need to temporarily use the full node_modules from /app
  cd /app
  DATABASE_URL="file:/data/sqlite.db" npx prisma db seed || echo "[init] Seeding failed or skipped"
  
  echo "[init] Database setup complete"
  cd /data
fi

########################################
# Always sync Prisma schema and client on every boot
# This ensures we have the latest migrations and generated client
########################################
echo "[init] Syncing Prisma schema and migrations..."
if [ -d "/app/prisma" ]; then
  rm -rf /data/prisma
  cp -r /app/prisma /data/
fi

# Always refresh Prisma Client to match the new schema
echo "[init] Syncing Prisma Client..."
if [ -d "/app/node_modules/.prisma" ]; then
  mkdir -p /data/node_modules
  rm -rf /data/node_modules/.prisma /data/node_modules/@prisma
  cp -r /app/node_modules/.prisma /data/node_modules/
  cp -r /app/node_modules/@prisma /data/node_modules/
fi

########################################
# Run database migrations on EVERY boot
# This ensures schema is always up-to-date
########################################
echo "[init] Running database migrations..."
cd /data
prisma migrate deploy || prisma db push
cd /data

########################################
# 2. Always sync static client assets
#    (JS chunks, CSS, fonts)
########################################

if [ -d "/app/next_build" ]; then
  echo "[init] Syncing Next.js static assets into /data/.next ..."
  mkdir -p /data/.next

  # Copy ALL .next files needed for the server to work
  cp -r /app/next_build/* /data/.next/

  echo "[init] Copied complete .next directory"
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

echo "[DEBUG] Final check - what's in /data/.next/:"
ls -la /data/.next/
echo "[DEBUG] server.js location:"
ls -la /data/server.js

########################################
# 4. Start the Next.js server
########################################
exec "$@"
