FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma

# Install all deps (including dev) for build
RUN npm install --include=dev

# Copy API source
COPY apps/api ./apps/api

# Build
RUN npm run build --workspace=apps/api

# --- Production image ---
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copy package files and install production deps only
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma

RUN npm install --omit=dev --workspace=apps/api --include-workspace-root \
  && npx --prefix apps/api prisma generate --schema=apps/api/prisma/schema.prisma

# Copy built output
COPY --from=builder /app/apps/api/dist ./apps/api/dist

EXPOSE 4000

CMD ["node", "apps/api/dist/main.js"]
