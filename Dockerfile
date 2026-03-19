# ── Stage 1: Build frontend ──────────────────────────────────
FROM node:20-bookworm-slim AS frontend-build

WORKDIR /frontend

# Vite env vars (inlined at build time)
ARG VITE_API_BASE_URL=/v1/auth
ARG VITE_CORE_API_BASE_URL=/v1
ARG VITE_WS_BASE_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_CORE_API_BASE_URL=$VITE_CORE_API_BASE_URL
ENV VITE_WS_BASE_URL=$VITE_WS_BASE_URL

# Install frontend dependencies
COPY frontend/package*.json ./
RUN npm ci

# Copy frontend source and build with Vite
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Backend + serve static frontend ─────────────────
FROM node:20-bookworm-slim

WORKDIR /app

# System packages for native dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install backend dependencies
COPY package*.json ./
RUN npm install

# Copy backend source
COPY . .

# Copy built frontend into /app/frontend/dist
COPY --from=frontend-build /frontend/dist ./frontend/dist

# Generate Prisma client
RUN npx prisma generate

# Configure port
ENV PORT=3000
EXPOSE 3000

# Run migrations and start backend (which serves frontend static files)
CMD sh -c "npx prisma migrate deploy && node src/app.js"
