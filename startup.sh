#!/bin/bash

# Ensure cache directories exist
mkdir -p /data/.next-cache

# Start the Next.js application
exec node server.js
