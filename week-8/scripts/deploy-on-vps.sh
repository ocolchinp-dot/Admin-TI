#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo "Missing .env. Copy .env.example to .env and set secure values first."
  exit 1
fi

docker compose --env-file .env pull
docker compose --env-file .env up -d
docker compose --env-file .env ps
