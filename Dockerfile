FROM node:20-alpine AS builder

WORKDIR /app

# OpenSSL needed for Prisma engine at build-time (prisma generate)
RUN apk add --no-cache openssl libc6-compat

# Copy everything (relies on .dockerignore to skip node_modules, etc.)
COPY . .

# Install all deps (including dev) and build API
RUN npm install --include=dev \
  && npm run build --workspace=apps/api

# --- Production image ---
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# OpenSSL needed for Prisma query engine at runtime
RUN apk add --no-cache openssl libc6-compat

# Copy package files + prisma schema
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma

# Install production deps only, generate Prisma client
RUN npm install --omit=dev --workspace=apps/api --include-workspace-root \
  && cd apps/api && npx prisma generate

# Copy built output from builder stage
COPY --from=builder /app/apps/api/dist ./apps/api/dist

EXPOSE 4000

CMD ["node", "apps/api/dist/main.js"]
