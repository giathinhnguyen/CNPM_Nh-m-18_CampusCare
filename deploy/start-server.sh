#!/usr/bin/env bash
set -euo pipefail
cd /opt/brewlite
environment=/opt/brewlite/.env.production
[ -f "$environment" ] || { echo 'Missing /opt/brewlite/.env.production'; exit 1; }
chmod 600 "$environment"
compose=(docker compose --env-file "$environment" -f docker-compose.prod.yml)

# Serial builds limit peak RAM usage on a small EC2 instance.
"${compose[@]}" build api
"${compose[@]}" build web
"${compose[@]}" up -d postgres
"${compose[@]}" run --rm api node node_modules/prisma/build/index.js migrate deploy

if [ "${1:-}" = '--initialize-empty-database' ]; then
  "${compose[@]}" run --rm -e DEPLOY_SEED_EMPTY_DATABASE=true api \
    node --import tsx prisma/seed-deployment.ts
fi

"${compose[@]}" up -d
"${compose[@]}" ps
printf 'BrewLite started. Update DuckDNS to the EC2 Elastic IP for HTTPS issuance.\n'
