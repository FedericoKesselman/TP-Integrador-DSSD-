#!/bin/sh
set -eu
: "${RESCUESYNC_BACKEND_URL:=http://localhost:4000}"
: "${BONITA_NOTIFICATION_TOKEN:?Exportá BONITA_NOTIFICATION_TOKEN con el mismo valor que el backend}"
export RESCUESYNC_BACKEND_URL BONITA_NOTIFICATION_TOKEN
exec /Applications/BonitaStudioCommunity-2025.2-u0.app/Contents/MacOS/BonitaStudioCommunity "$@"
