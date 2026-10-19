#!/bin/sh
set -e

# Inject runtime configuration. Demo data is a build-time, development-only
# option and can never be enabled in a production container.
cat > /usr/share/nginx/html/env-config.js << EOF2
window.ENV = {
  API_BASE_URL: "${API_BASE_URL:-http://localhost:3000}",
  AUTH_LOGIN_PATH: "${AUTH_LOGIN_PATH:-/v1/auth/login}"
};
EOF2

echo "Runtime environment configuration injected:"
cat /usr/share/nginx/html/env-config.js
