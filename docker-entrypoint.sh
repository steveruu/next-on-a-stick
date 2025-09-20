#!/bin/sh
set -e

# The /data directory is the only writable location.
# We'll run the entire server from /data to avoid read-only filesystem issues.
mkdir -p /data/.next

# Copy the complete standalone application to writable location on first run
if [ ! -f /data/server.js ]; then
  echo "Setting up standalone server in writable directory..."
  
  # Copy the complete standalone build (includes bundled dependencies)
  if [ -d "/app/standalone" ]; then
    echo "Copying standalone application..."
    cp -r /app/standalone/. /data/
    echo "Standalone application copied."
  else
    echo "Warning: No standalone build found in /app/standalone"
  fi
  
  # Copy public files 
  if [ -d "/app/public" ]; then
    echo "Copying public files..."
    cp -r /app/public /data/
  fi
  
  # Copy prisma files for database operations
  if [ -d "/app/prisma" ]; then
    echo "Copying Prisma files..."
    cp -r /app/prisma /data/
  fi
  
  # If standalone node_modules is incomplete, copy the full one from /app
  if [ ! -d "/data/node_modules/next" ] && [ -d "/app/node_modules" ]; then
    echo "Standalone node_modules incomplete, copying full node_modules..."
    cp -r /app/node_modules /data/
    echo "Full node_modules copied."
  elif [ -d "/app/node_modules/.prisma" ]; then
    echo "Copying additional Prisma runtime files..."
    mkdir -p /data/node_modules
    cp -r /app/node_modules/.prisma /data/node_modules/
    cp -r /app/node_modules/prisma /data/node_modules/
    cp -r /app/node_modules/@prisma /data/node_modules/
    # Copy the prisma binary
    mkdir -p /data/node_modules/.bin
    cp /app/node_modules/.bin/prisma /data/node_modules/.bin/ 2>/dev/null || echo "Prisma binary not found"
  fi
fi

# Copy/update the .next build artifacts to the writable location
if [ ! -f /data/.next/BUILD_ID ] || [ /app/next_build -nt /data/.next ]; then
  echo "Updating .next build artifacts in writable location..."
  
  if [ -d "/app/next_build" ]; then
    echo "Copying Next.js build artifacts to /data/.next..."
    cp -r /app/next_build/. /data/.next/
    echo "Build artifacts copied successfully."
  else
    echo "Warning: No build artifacts found in /app/next_build"
  fi
fi

# Verify essential files exist
if [ ! -f "/data/server.js" ]; then
  echo "ERROR: server.js not found in /data"
  exit 1
fi

if [ ! -f "/data/.next/BUILD_ID" ]; then
  echo "ERROR: Next.js build artifacts not found"
  exit 1
fi

echo "Application setup complete. Starting server..."

# Apply database migrations.
# echo "Applying database migrations..."
# ./node_modules/.bin/prisma db push

# Start the application
echo "Starting Next.js application..."
exec "$@"
