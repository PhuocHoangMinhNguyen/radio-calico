# Dockerfile for Radio Calico
# Multi-stage build supporting both development and production targets
# Base image pinned for reproducibility

# Stage 1: Base Node.js environment
# Updated to Node.js 22 LTS to satisfy Angular 21 requirement (requires >=20.19 or >=22.12)
FROM node:25-alpine AS base
WORKDIR /app

# Install system dependencies required for node-gyp (pg native bindings)
RUN apk add --no-cache python3 make g++

# Copy package files and install dependencies
# Separate layer for better caching - dependencies change less frequently than source
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline --no-audit --no-fund --legacy-peer-deps

# Stage 2: Development target
# Used for local development with hot-reload support
FROM base AS development

# Development-specific labels
LABEL stage=development
LABEL description="Radio Calico development environment with hot-reload"

# Copy all source files
# In dev mode, docker-compose will mount source as a volume for live updates
COPY . .

# Expose ports:
# 3000 - Angular dev server
# 3001 - Node API server
EXPOSE 3000 3001

# Health check for dev API server
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/ratings?title=health&artist=check', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Default command runs both Angular dev server and API server concurrently
CMD ["npm", "run", "dev"]

# Stage 3: Builder for production
# Compiles Angular app to static assets
FROM base AS builder

LABEL stage=builder
LABEL description="Build stage for Angular production compilation"

# Copy source files
COPY . .

# Build Angular app with production optimizations
# Output: dist/radio-calico/browser/
RUN npm run build:prod

# Stage 4: Production target
# Minimal runtime image with only production dependencies and built assets
FROM node:25-alpine AS production

LABEL maintainer="Radio Calico"
LABEL description="Radio Calico production server - Angular + Node.js API"
LABEL stage=production

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --prefer-offline --no-audit --no-fund --legacy-peer-deps

# Copy backend server
COPY server.js ./

# Copy built Angular assets from builder stage
COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Production runs on single port 3000 (serves both static files and API)
EXPOSE 3000

# Health check for production server
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Production mode: single Node server serves both static files and API
CMD ["node", "server.js"]
