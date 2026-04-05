#!/usr/bin/env bash
# setup.sh — build and start ouch via Docker Compose
set -euo pipefail

echo "==> Building Docker images…"
docker compose build --build-arg BUILDKIT_INLINE_CACHE=1

echo ""
echo "Done! To start the app:"
echo ""
echo "  docker compose up"
echo ""
echo "Then open http://localhost:5173"
echo ""
echo "Other useful commands:"
echo "  docker compose up --build   # rebuild and start"
echo "  docker compose down         # stop and remove containers"
echo "  docker compose logs -f      # follow logs"
