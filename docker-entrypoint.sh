#!/bin/sh
set -e

# The /data directory is the only writable location.
# Ensure the directory structure that .next expects exists within /data.
mkdir -p /data/.next/server
mkdir -p /data/.next/static

# On container startup, copy the pre-built Next.js server and static files
# to the writable /data volume, if they don't already exist.
# This "seeds" the volume with the build artifacts, but allows the running
# application to modify them (e.g., for ISR).
if [ ! -f /data/.next/server/pages-manifest.json ]; then
  echo "Initializing writable .next volume from build artifacts..."
  # Copy into the writable /data directory directly.
  cp -a /app/standalone_next/server/. /data/.next/server/
  cp -a /app/standalone_next/static/. /data/.next/static/
fi

# Apply database migrations.
# NOTE: You've commented this out. Uncomment it to run migrations on startup.
# echo "Applying database migrations..."
# ./node_modules/.bin/prisma db push

# Start the application
echo "Starting Next.js application..."
exec "$@"
