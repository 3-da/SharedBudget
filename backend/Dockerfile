# ── Stage 1: Build ──────────────────────────────────────────
FROM node:22-alpine@sha256:e4bf2a82ad0a4037d28035ae71529873c069b13eb0455466ae0bc13363826e34 AS build
WORKDIR /app

# argon2 requires native compilation tools
RUN apk add --no-cache python3 make g++

# Upgrade npm to match the version used to generate package-lock.json
RUN npm install -g npm@11

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma/
RUN npx prisma generate --schema ./prisma/schema.prisma

COPY . .
RUN npm run build

# ── Stage 2: Production ────────────────────────────────────
FROM node:22-alpine@sha256:e4bf2a82ad0a4037d28035ae71529873c069b13eb0455466ae0bc13363826e34 AS production
WORKDIR /app

# argon2 native bindings need rebuilding for production image
RUN apk add --no-cache python3 make g++

# Upgrade npm to match the version used to generate package-lock.json
RUN npm install -g npm@11

COPY package*.json ./
RUN npm ci --omit=dev && apk del python3 make g++

# Copy built application (includes compiled Prisma client at dist/src/generated/prisma)
COPY --from=build /app/dist ./dist
# Migrations must be present at runtime so prisma migrate deploy can run on startup
COPY --from=build /app/prisma ./prisma

ENV NODE_ENV=production

USER node
EXPOSE 3000

# Run pending migrations then start the server.
# preDeployCommand is not available on Render's free tier, so migrations run here instead.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
