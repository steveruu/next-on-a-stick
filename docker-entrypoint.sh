#!/bin/sh
set -e

# The /data directory is the only writable location.
# Ensure the directory structure that .next expects exists within /data.
mkdir -p /data/.next

# On container startup, copy the pre-built Next.js build artifacts
# to the writable /data volume, if they don't already exist.
if [ ! -f /data/.next/BUILD_ID ]; then
  echo "Initializing writable .next volume from build artifacts..."
  
  # Copy the Next.js build from our staging location
  if [ -d "/app/next_build" ]; then
    echo "Copying Next.js build artifacts to /data/.next..."
    cp -r /app/next_build/. /data/.next/
    echo "Build artifacts copied successfully."
  else
    echo "Warning: No build artifacts found in /app/next_build"
  fi
fi

# Create symbolic link so the server can find .next directory in the writable location
if [ ! -e "/app/.next" ]; then
  echo "Creating symbolic link from /app/.next to /data/.next..."
  ln -s /data/.next /app/.next
else
  echo "Note: /app/.next already exists, server will use existing location"
fi

# Apply database migrations.
# NOTE: You've commented this out. Uncomment it to run migrations on startup.
# echo "Applying database migrations..."
# ./node_modules/.bin/prisma db push

# Start the application
echo "Starting Next.js application..."
exec "$@"
