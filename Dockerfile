# ==============================================================================
# TeleFlow Pro — Production Multi-Stage Dockerfile
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (leverage layer cache)
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# Copy source files
COPY . .

# Build application for production
RUN npm run build

# ------------------------------------------------------------------------------
# Production Runner Image
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Create app directory & non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 teleflow

# Copy built server and public assets
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/entrypoint.sh ./entrypoint.sh

# Create local data directory for file-backed storage if running in Node
RUN mkdir -p /app/data && chown -R teleflow:nodejs /app

USER teleflow

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
