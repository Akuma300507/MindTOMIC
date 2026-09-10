# Stage 1: Build Frontend and Server Bundle
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci || npm install

# Copy application source files
COPY tsconfig*.json vite.config.ts index.html ./
COPY src/ ./src/
COPY public/ ./public/
COPY server.ts ./

# Build production assets (Vite client + esbuild server bundle)
RUN npm run build

# Stage 2: Minimal Production Image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data
ENV UPLOADS_DIR=/app/uploads

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy built distribution from builder
COPY --from=builder /app/dist ./dist
COPY public/ ./public/

# Create persistent storage directories with appropriate permissions
RUN mkdir -p /app/data /app/uploads

# Persistent storage volumes for database and uploaded media
VOLUME ["/app/data", "/app/uploads"]

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "dist/server.cjs"]
