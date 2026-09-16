#!/bin/sh
set -e

echo "Starting TeleFlow Pro Server..."
exec node .output/server/index.mjs
