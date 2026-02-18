# ── Stage 1: Build ──────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# argon2 requires native compilation tools
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma/
RUN npx prisma generate --schema ./prisma/schema.prisma

COPY . .
RUN npm run build

# ── Stage 2: Production ────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app

# argon2 native bindings need rebuilding for production image
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev && apk del python3 make g++

# Copy built application (includes compiled Prisma client at dist/src/generated/prisma)
COPY --from=build /app/dist ./dist

ENV NODE_ENV=production

USER node
EXPOSE 3000

# TypeScript compiles src/ → dist/src/ (no rootDir set, so tsc preserves the src/ prefix)
CMD ["node", "dist/src/main"]
