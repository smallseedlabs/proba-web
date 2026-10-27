#!/bin/sh
set -e

# Inject runtime configuration. Values left empty fall back to the build-time
# VITE_* values. Demo data is a build-time, development-only option and can
# never be enabled in a production container.
cat > /usr/share/nginx/html/env-config.js << EOF2
window.ENV = {
  API_BASE_URL: "${API_BASE_URL:-http://localhost:3000}",
  AUDIT_API_BASE_URL: "${AUDIT_API_BASE_URL:-}",
  FIREBASE_API_KEY: "${FIREBASE_API_KEY:-}",
  FIREBASE_AUTH_DOMAIN: "${FIREBASE_AUTH_DOMAIN:-}",
  FIREBASE_PROJECT_ID: "${FIREBASE_PROJECT_ID:-}",
  FIREBASE_APP_ID: "${FIREBASE_APP_ID:-}"
};
EOF2

echo "Runtime environment configuration injected:"
cat /usr/share/nginx/html/env-config.js
