// Production Prisma config — no dotenv needed (env vars injected by Render)
// Uses .mjs to avoid needing ts-node/tsx at runtime
import { defineConfig } from 'prisma/config';

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations',
    },
    datasource: {
        url: process.env.DATABASE_URL,
    },
});
