#!/bin/sh
set -e

# This script is executed on container startup.
# It applies database migrations and then starts the Next.js application.

# Apply database migrations
echo "Applying database migrations..."
npx --no-install prisma db push

# Start the application
echo "Starting Next.js application..."
exec "$@"
