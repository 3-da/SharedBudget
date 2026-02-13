# ── Stage 1: Build ──────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# argon2 requires native compilation tools
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN npx prisma generate --config prisma.config.ts

COPY . .
RUN npm run build

# ── Stage 2: Production ────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app

# argon2 native bindings need rebuilding for production image
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev && apk del python3 make g++

# Re-generate Prisma client (needed for production node_modules)
COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN npx prisma generate --config prisma.config.ts

# Copy built application
COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/main"]
