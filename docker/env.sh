#!/bin/sh
set -e

cat > /usr/share/nginx/html/env-config.js << EOF
window.ENV = {
  API_BASE_URL: "${API_BASE_URL:-http://localhost:3000}",
  MOCK_MODE: "${MOCK_MODE:-false}"
};
EOF

echo "Runtime environment configuration injected:"
cat /usr/share/nginx/html/env-config.js
