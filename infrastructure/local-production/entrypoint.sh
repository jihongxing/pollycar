#!/bin/sh
set -eu

database_password="$(cat /run/local-production/postgres-password.txt)"
export POLLYCAR_PRODUCTION_DATABASE_URL="postgresql://pollycar:${database_password}@postgres:5432/pollycar?sslmode=verify-full"

exec "$@"
