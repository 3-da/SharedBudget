import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { DEMO_ACCOUNT_EMAILS, DEMO_ACCOUNT_PASSWORD } from '../src/demo-data/demo-seed.constants.js';
import { getDemoReferenceDate } from '../src/demo-data/demo-month-periods.js';
import { replaceDemoData } from '../src/demo-data/demo-seed.core.js';

async function seedDemoData(): Promise<void> {
    const databaseUrl = getRequiredDatabaseUrl();
    const prismaClient = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

    try {
        await prismaClient.$connect();
        const demoReferenceDate = getDemoReferenceDate(process.env.DEMO_REFERENCE_MONTH);
        const seededThroughMonthPeriod = await replaceDemoData(prismaClient, demoReferenceDate);
        printDemoSeedSummary(seededThroughMonthPeriod);
    } finally {
        await prismaClient.$disconnect();
    }
}

function getRequiredDatabaseUrl(): string {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error('DATABASE_URL is required to seed demo data');
    }

    return databaseUrl;
}

function printDemoSeedSummary(currentDemoMonthPeriod: { month: number; year: number }): void {
    console.log(`Demo data reset through ${currentDemoMonthPeriod.year}-${String(currentDemoMonthPeriod.month).padStart(2, '0')}.`);
    console.log(`Accounts: ${DEMO_ACCOUNT_EMAILS.join(', ')} / ${DEMO_ACCOUNT_PASSWORD}`);
}

seedDemoData().catch((seedError: unknown) => {
    console.error('Demo seed failed:', seedError);
    process.exitCode = 1;
});
