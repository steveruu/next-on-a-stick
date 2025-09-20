#!/bin/sh
set -e

# The /data directory is the only writable location.
# Ensure the .next directory exists within /data.
mkdir -p /data/.next

# On container startup, copy the pre-built Next.js artifacts
# from the temporary location to the writable /data volume,
# if the volume hasn't been initialized yet.
if [ ! -f /data/.next/BUILD_ID ]; then
  echo "Initializing writable .next volume from build artifacts..."
  # Use `cp -r` to avoid trying to preserve ownership.
  # The `.` at the end of the source is important to copy contents.
  cp -r /app/standalone_next/. /data/.next/
fi

# Apply database migrations.
# NOTE: You've commented this out. Uncomment it to run migrations on startup.
# echo "Applying database migrations..."
# ./node_modules/.bin/prisma db push

# Start the application
echo "Starting Next.js application..."
exec "$@"
