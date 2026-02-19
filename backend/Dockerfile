# ── Stage 1: Build ──────────────────────────────────────────
FROM node:22-alpine@sha256:e4bf2a82ad0a4037d28035ae71529873c069b13eb0455466ae0bc13363826e34 AS build
WORKDIR /app

# argon2 requires native compilation tools
RUN apk add --no-cache python3 make g++

# deterministic install (uses package-lock.json)
COPY package*.json ./
RUN npm ci

# IMPORTANT: copy repo BEFORE prisma generate so tsconfig/nodenext is present
COPY . .

# prisma generate (dummy DB URL satisfies env() validation)
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate

# build NestJS
RUN npm run build


# ── Stage 2: Production ─────────────────────────────────────
FROM node:22-alpine@sha256:e4bf2a82ad0a4037d28035ae71529873c069b13eb0455466ae0bc13363826e34 AS production
WORKDIR /app

# argon2 native bindings need compilation tools
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev && apk del python3 make g++

# Copy built application
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.production.mjs ./prisma.config.production.mjs

ENV NODE_ENV=production

USER node
EXPOSE 3000

# If prisma CLI is NOT installed in prod deps, this pins the downloaded CLI version to match your client.
CMD ["sh", "-c", "npx prisma@7.3.0 migrate deploy --config ./prisma.config.production.mjs && node dist/src/main"]
