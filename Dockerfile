# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# git is needed to resolve the protocol package from GitHub.
RUN apk add --no-cache git

COPY package*.json ./
RUN npm ci

# Production images never include demo data.
ENV VITE_DEMO_MODE=false

COPY . .
RUN npm run build && npm run check:bundle

# Stage 2: Production
FROM nginx:1.25-alpine

RUN addgroup -g 1001 -S probauser && \
    adduser -u 1001 -S probauser -G probauser

COPY --from=builder /app/dist /usr/share/nginx/html

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/env.sh /docker-entrypoint.d/env.sh
RUN chmod +x /docker-entrypoint.d/env.sh

RUN chown -R probauser:probauser /usr/share/nginx/html && \
    chown -R probauser:probauser /var/cache/nginx && \
    chown -R probauser:probauser /var/log/nginx && \
    chown -R probauser:probauser /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R probauser:probauser /var/run/nginx.pid

USER probauser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
