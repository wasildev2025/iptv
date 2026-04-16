FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install --include=dev

COPY . .
RUN npx nest build

# --- Production image ---
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
COPY prisma ./prisma

RUN npm install --omit=dev && npx prisma generate

COPY --from=builder /app/dist ./dist

EXPOSE 4000

CMD ["node", "dist/main.js"]
