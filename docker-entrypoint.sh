#!/bin/sh
set -e

# The /data directory is the only writable location.
# We'll run the entire server from /data to avoid read-only filesystem issues.
mkdir -p /data/.next

# Copy server files to writable location on first run
if [ ! -f /data/server.js ]; then
  echo "Setting up server in writable directory..."
  
  # Copy essential server files
  cp /app/server.js /data/ 2>/dev/null || echo "Warning: server.js not found"
  cp /app/package.json /data/ 2>/dev/null || echo "Warning: package.json not found"
  
  # Copy node_modules if needed for standalone
  if [ -d "/app/node_modules" ]; then
    echo "Copying node_modules to writable location..."
    cp -r /app/node_modules /data/
  fi
  
  # Copy public files 
  if [ -d "/app/public" ]; then
    echo "Copying public files..."
    cp -r /app/public /data/
  fi
  
  # Copy prisma files
  if [ -d "/app/prisma" ]; then
    echo "Copying Prisma files..."
    cp -r /app/prisma /data/
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

# Apply database migrations.
# NOTE: You've commented this out. Uncomment it to run migrations on startup.
# echo "Applying database migrations..."
# ./node_modules/.bin/prisma db push

# Start the application
echo "Starting Next.js application..."
exec "$@"
