#!/bin/sh
set -e

# The /data directory is the only writable location.
# Ensure the directory structure that .next expects exists within /data.
mkdir -p /data/.next

# On container startup, copy the pre-built Next.js server and static files
# to the writable /data volume, if they don't already exist.
# This "seeds" the volume with the build artifacts, but allows the running
# application to modify them (e.g., for ISR).
if [ ! -f /data/.next/BUILD_ID ]; then
  echo "Initializing writable .next volume from build artifacts..."
  
  # Check if standalone_next directory exists and copy all contents
  if [ -d "/app/standalone_next" ]; then
    echo "Copying from standalone_next directory..."
    cp -r /app/standalone_next/. /data/.next/
  fi
  
  # Also check for any remaining .next files in the app directory
  if [ -d "/app/.next_backup" ]; then
    echo "Copying from .next_backup directory..."
    cp -r /app/.next_backup/. /data/.next/
  fi
  
  # Ensure essential files exist
  if [ ! -f /data/.next/routes-manifest.json ] && [ -f /app/standalone_next/routes-manifest.json ]; then
    cp /app/standalone_next/routes-manifest.json /data/.next/routes-manifest.json
  fi
  
  echo "Build artifacts initialization complete."
fi

# Static files are already copied to public/_next/static in Dockerfile

# Apply database migrations.
# NOTE: You've commented this out. Uncomment it to run migrations on startup.
# echo "Applying database migrations..."
# ./node_modules/.bin/prisma db push

# Start the application
echo "Starting Next.js application..."
exec "$@"
