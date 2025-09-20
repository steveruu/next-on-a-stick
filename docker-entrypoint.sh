#!/bin/sh
set -e

# The /data directory is the only writable location.
# We'll run the entire server from /data to avoid read-only filesystem issues.
mkdir -p /data/.next

# Copy the complete standalone application to writable location on first run
if [ ! -f /data/server.js ]; then
  echo "Setting up standalone server in writable directory..."
  
  # Debug: Check what's actually in the standalone directory
  echo "DEBUG: Checking standalone directory structure..."
  ls -la /app/ | head -20
  echo "---"
  if [ -d "/app/standalone" ]; then
    echo "Found standalone directory, contents:"
    ls -la /app/standalone/ | head -20
    echo "---"
  fi
  
  # Copy the complete standalone build (includes bundled dependencies)
  if [ -d "/app/standalone" ]; then
    echo "Copying standalone application..."
    cp -r /app/standalone/. /data/
    echo "Standalone application copied."
    echo "DEBUG: Contents of /data after copy:"
    ls -la /data/ | head -20
    echo "---"
    if [ -f "/data/server.js" ]; then
      echo "DEBUG: First few lines of server.js:"
      head -20 /data/server.js
      echo "---"
    fi
    if [ -d "/data/node_modules" ]; then
      echo "DEBUG: node_modules exists in /data"
      ls -la /data/node_modules/ | head -10
      echo "---"
    fi
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
    echo "DEBUG: Contents of /data/.next after copy:"
    ls -la /data/.next/ | head -20
    echo "---"
    if [ -f "/data/.next/BUILD_ID" ]; then
      echo "DEBUG: BUILD_ID exists:"
      cat /data/.next/BUILD_ID
      echo "---"
    fi
    
    # Check for static HTML files
    echo "DEBUG: Checking for static HTML files..."
    if [ -d "/data/.next/server" ]; then
      echo "Server directory contents:"
      find /data/.next/server -name "*.html" | head -10
    fi
    if [ -d "/data/.next/static" ]; then
      echo "Static directory exists"
      ls -la /data/.next/static/ | head -5
    fi
    echo "---"
  else
    echo "Warning: No build artifacts found in /app/next_build"
  fi
fi

# Final debug: Check complete structure before starting server
echo "DEBUG: Final /data structure before server start:"
find /data -maxdepth 2 -type f | head -30
echo "---"
echo "DEBUG: Check if key files exist:"
echo "server.js: $(test -f /data/server.js && echo 'EXISTS' || echo 'MISSING')"
echo "package.json: $(test -f /data/package.json && echo 'EXISTS' || echo 'MISSING')"  
echo ".next/BUILD_ID: $(test -f /data/.next/BUILD_ID && echo 'EXISTS' || echo 'MISSING')"
echo "public dir: $(test -d /data/public && echo 'EXISTS' || echo 'MISSING')"
echo "node_modules/next: $(test -d /data/node_modules/next && echo 'EXISTS' || echo 'MISSING')"
echo "---"

# Apply database migrations.
# NOTE: You've commented this out. Uncomment it to run migrations on startup.
# echo "Applying database migrations..."
# ./node_modules/.bin/prisma db push

# Start the application
echo "Starting Next.js application..."
exec "$@"
