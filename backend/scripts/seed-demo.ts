/**
 * Demo Data Seed Script
 *
 * Creates demo accounts and realistic budget data for employer evaluation.
 * Safe to re-run: wipes all demo data first, then recreates from scratch.
 *
 * Usage (from Render shell or locally):
 *   cd backend
 *   npx ts-node --esm scripts/seed-demo.ts
 *
 * Demo accounts created:
 *   alex@demo.com / Demo1234!  (Household Owner)
 *   sam@demo.com  / Demo1234!  (Household Member)
 *   jordan@demo.com / Demo1234! (No household — fresh user)
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import * as argon2 from 'argon2';

const DEMO_EMAILS = ['alex@demo.com', 'sam@demo.com', 'jordan@demo.com'];
const DEMO_PASSWORD = 'Demo1234!';
const HOUSEHOLD_NAME = 'Demo Household';
const INVITE_CODE = 'DEMO2026';

// Current month/year for seed data
const NOW = new Date();
const CURRENT_MONTH = NOW.getMonth() + 1; // 1-based
const CURRENT_YEAR = NOW.getFullYear();
const PREV_MONTH = CURRENT_MONTH === 1 ? 12 : CURRENT_MONTH - 1;
const PREV_YEAR = CURRENT_MONTH === 1 ? CURRENT_YEAR - 1 : CURRENT_YEAR;

async function main(): Promise<void> {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
    const prisma = new PrismaClient({ adapter });
    await prisma.$connect();

    console.log('🧹 Cleaning existing demo data...');
    await cleanDemoData(prisma);

    console.log('🔑 Hashing password...');
    const hashedPassword = await argon2.hash(DEMO_PASSWORD, {
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
    });

    console.log('👤 Creating demo users...');
    const [alex, sam, jordan] = await createUsers(prisma, hashedPassword);

    console.log('🏠 Creating household...');
    const household = await createHousehold(prisma, alex.id, sam.id);

    console.log('💰 Creating salaries...');
    await createSalaries(prisma, alex.id, sam.id, household.id);

    console.log('📝 Creating personal expenses...');
    await createPersonalExpenses(prisma, alex.id, sam.id, household.id);

    console.log('🤝 Creating shared expenses...');
    const sharedExpenses = await createSharedExpenses(prisma, alex.id, sam.id, household.id);

    console.log('📋 Creating pending approvals...');
    await createPendingApprovals(prisma, alex.id, sam.id, household.id, sharedExpenses);

    console.log('💸 Creating settlement history...');
    await createSettlements(prisma, alex.id, sam.id, household.id);

    console.log(`\n✅ Demo data seeded successfully!\n`);
    console.log('Demo accounts:');
    console.log(`  alex@demo.com    / ${DEMO_PASSWORD}  (Owner)`);
    console.log(`  sam@demo.com     / ${DEMO_PASSWORD}  (Member)`);
    console.log(`  jordan@demo.com  / ${DEMO_PASSWORD}  (No household)`);
    console.log(`\nHousehold: "${HOUSEHOLD_NAME}" | Invite code: ${INVITE_CODE}`);
    console.log(`Jordan can join using the invite code.\n`);

    await prisma.$disconnect();
}

/**
 * Deletes all data associated with demo accounts.
 * Uses cascading deletes via household, plus direct user cleanup.
 */
async function cleanDemoData(prisma: PrismaClient): Promise<void> {
    // Find existing demo users
    const existingUsers = await prisma.user.findMany({
        where: { email: { in: DEMO_EMAILS } },
        select: { id: true, email: true },
    });

    if (existingUsers.length === 0) {
        console.log('  No existing demo data found.');
        return;
    }

    const userIds = existingUsers.map((u) => u.id);
    console.log(`  Found ${existingUsers.length} existing demo user(s): ${existingUsers.map((u) => u.email).join(', ')}`);

    // Delete household (cascades: members, expenses, approvals, salaries, settlements, savings, invitations)
    const memberships = await prisma.householdMember.findMany({
        where: { userId: { in: userIds } },
        select: { householdId: true },
    });
    const householdIds = [...new Set(memberships.map((m) => m.householdId))];

    if (householdIds.length > 0) {
        await prisma.household.deleteMany({ where: { id: { in: householdIds } } });
        console.log(`  Deleted ${householdIds.length} household(s) (cascaded all related data).`);
    }

    // Delete invitations where demo users are targets (from non-demo households)
    await prisma.householdInvitation.deleteMany({
        where: { targetUserId: { in: userIds } },
    });

    // Delete the users themselves
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    console.log(`  Deleted ${userIds.length} demo user(s).`);
}

async function createUsers(
    prisma: PrismaClient,
    hashedPassword: string,
): Promise<[{ id: string }, { id: string }, { id: string }]> {
    const alex = await prisma.user.create({
        data: {
            email: 'alex@demo.com',
            password: hashedPassword,
            firstName: 'Alex',
            lastName: 'Demo',
            emailVerified: true,
        },
    });

    const sam = await prisma.user.create({
        data: {
            email: 'sam@demo.com',
            password: hashedPassword,
            firstName: 'Sam',
            lastName: 'Demo',
            emailVerified: true,
        },
    });

    const jordan = await prisma.user.create({
        data: {
            email: 'jordan@demo.com',
            password: hashedPassword,
            firstName: 'Jordan',
            lastName: 'Demo',
            emailVerified: true,
        },
    });

    return [alex, sam, jordan];
}

async function createHousehold(
    prisma: PrismaClient,
    alexId: string,
    samId: string,
): Promise<{ id: string }> {
    const household = await prisma.household.create({
        data: {
            name: HOUSEHOLD_NAME,
            inviteCode: INVITE_CODE,
            maxMembers: 2,
            members: {
                create: [
                    { userId: alexId, role: 'OWNER' },
                    { userId: samId, role: 'MEMBER' },
                ],
            },
        },
    });

    return household;
}

async function createSalaries(
    prisma: PrismaClient,
    alexId: string,
    samId: string,
    householdId: string,
): Promise<void> {
    // Current month salaries
    await prisma.salary.createMany({
        data: [
            {
                userId: alexId,
                householdId,
                defaultAmount: 4500,
                currentAmount: 4800, // Bonus month
                month: CURRENT_MONTH,
                year: CURRENT_YEAR,
            },
            {
                userId: samId,
                householdId,
                defaultAmount: 3200,
                currentAmount: 3200,
                month: CURRENT_MONTH,
                year: CURRENT_YEAR,
            },
        ],
    });

    // Previous month salaries (for history)
    await prisma.salary.createMany({
        data: [
            {
                userId: alexId,
                householdId,
                defaultAmount: 4500,
                currentAmount: 4500,
                month: PREV_MONTH,
                year: PREV_YEAR,
            },
            {
                userId: samId,
                householdId,
                defaultAmount: 3200,
                currentAmount: 3200,
                month: PREV_MONTH,
                year: PREV_YEAR,
            },
        ],
    });
}

async function createPersonalExpenses(
    prisma: PrismaClient,
    alexId: string,
    samId: string,
    householdId: string,
): Promise<void> {
    // Alex's personal expenses
    await prisma.expense.createMany({
        data: [
            {
                householdId,
                createdById: alexId,
                name: 'Gym Membership',
                amount: 45,
                type: 'PERSONAL',
                category: 'RECURRING',
                frequency: 'MONTHLY',
            },
            {
                householdId,
                createdById: alexId,
                name: 'Spotify Premium',
                amount: 12,
                type: 'PERSONAL',
                category: 'RECURRING',
                frequency: 'MONTHLY',
            },
            {
                householdId,
                createdById: alexId,
                name: 'Car Insurance',
                amount: 1200,
                type: 'PERSONAL',
                category: 'RECURRING',
                frequency: 'YEARLY',
                yearlyPaymentStrategy: 'INSTALLMENTS',
                installmentFrequency: 'QUARTERLY',
                installmentCount: 4,
            },
            {
                householdId,
                createdById: alexId,
                name: 'Haircut',
                amount: 35,
                type: 'PERSONAL',
                category: 'ONE_TIME',
                frequency: 'MONTHLY',
                month: CURRENT_MONTH,
                year: CURRENT_YEAR,
            },
        ],
    });

    // Sam's personal expenses
    await prisma.expense.createMany({
        data: [
            {
                householdId,
                createdById: samId,
                name: 'Yoga Studio',
                amount: 60,
                type: 'PERSONAL',
                category: 'RECURRING',
                frequency: 'MONTHLY',
            },
            {
                householdId,
                createdById: samId,
                name: 'Adobe Creative Cloud',
                amount: 55,
                type: 'PERSONAL',
                category: 'RECURRING',
                frequency: 'MONTHLY',
            },
            {
                householdId,
                createdById: samId,
                name: 'Train Pass Annual',
                amount: 2400,
                type: 'PERSONAL',
                category: 'RECURRING',
                frequency: 'YEARLY',
                yearlyPaymentStrategy: 'INSTALLMENTS',
                installmentFrequency: 'MONTHLY',
                installmentCount: 12,
            },
            {
                householdId,
                createdById: samId,
                name: 'New Headphones',
                amount: 180,
                type: 'PERSONAL',
                category: 'ONE_TIME',
                frequency: 'MONTHLY',
                month: CURRENT_MONTH,
                year: CURRENT_YEAR,
            },
        ],
    });
}

async function createSharedExpenses(
    prisma: PrismaClient,
    alexId: string,
    samId: string,
    householdId: string,
): Promise<{ groceriesId: string }> {
    // Shared expenses — all proposed by Alex, accepted by Sam (so they're active)
    const rent = await prisma.expense.create({
        data: {
            householdId,
            createdById: alexId,
            name: 'Rent',
            amount: 1400,
            type: 'SHARED',
            category: 'RECURRING',
            frequency: 'MONTHLY',
            paidByUserId: null, // Split equally
        },
    });

    const electricity = await prisma.expense.create({
        data: {
            householdId,
            createdById: samId,
            name: 'Electricity',
            amount: 120,
            type: 'SHARED',
            category: 'RECURRING',
            frequency: 'MONTHLY',
        },
    });

    const internet = await prisma.expense.create({
        data: {
            householdId,
            createdById: alexId,
            name: 'Internet',
            amount: 45,
            type: 'SHARED',
            category: 'RECURRING',
            frequency: 'MONTHLY',
            paidByUserId: alexId, // Alex pays full — his name on contract
        },
    });

    const groceries = await prisma.expense.create({
        data: {
            householdId,
            createdById: samId,
            name: 'Groceries',
            amount: 450,
            type: 'SHARED',
            category: 'RECURRING',
            frequency: 'MONTHLY',
        },
    });

    const netflix = await prisma.expense.create({
        data: {
            householdId,
            createdById: alexId,
            name: 'Netflix',
            amount: 18,
            type: 'SHARED',
            category: 'RECURRING',
            frequency: 'MONTHLY',
        },
    });

    const homeInsurance = await prisma.expense.create({
        data: {
            householdId,
            createdById: alexId,
            name: 'Home Insurance',
            amount: 600,
            type: 'SHARED',
            category: 'RECURRING',
            frequency: 'YEARLY',
            yearlyPaymentStrategy: 'INSTALLMENTS',
            installmentFrequency: 'SEMI_ANNUAL',
            installmentCount: 2,
        },
    });

    const vacationFund = await prisma.expense.create({
        data: {
            householdId,
            createdById: samId,
            name: 'Vacation Fund',
            amount: 2400,
            type: 'SHARED',
            category: 'RECURRING',
            frequency: 'YEARLY',
            yearlyPaymentStrategy: 'INSTALLMENTS',
            installmentFrequency: 'MONTHLY',
            installmentCount: 12,
        },
    });

    const newCouch = await prisma.expense.create({
        data: {
            householdId,
            createdById: alexId,
            name: 'New Couch',
            amount: 350,
            type: 'SHARED',
            category: 'ONE_TIME',
            frequency: 'MONTHLY',
            month: CURRENT_MONTH,
            year: CURRENT_YEAR,
        },
    });

    // Create ACCEPTED approvals for all shared expenses (so they appear as active)
    const sharedExpenses = [rent, electricity, internet, groceries, netflix, homeInsurance, vacationFund, newCouch];
    await prisma.expenseApproval.createMany({
        data: sharedExpenses.map((expense) => ({
            expenseId: expense.id,
            householdId,
            action: 'CREATE' as const,
            status: 'ACCEPTED' as const,
            requestedById: expense.createdById,
            reviewedById: expense.createdById === alexId ? samId : alexId,
            message: 'Looks good!',
            reviewedAt: new Date(),
        })),
    });

    return { groceriesId: groceries.id };
}

async function createPendingApprovals(
    prisma: PrismaClient,
    alexId: string,
    samId: string,
    householdId: string,
    sharedExpenses: { groceriesId: string },
): Promise<void> {
    // 1. Sam proposes a NEW shared expense: "Cleaning Service"
    await prisma.expenseApproval.create({
        data: {
            householdId,
            action: 'CREATE',
            status: 'PENDING',
            requestedById: samId,
            proposedData: {
                name: 'Cleaning Service',
                amount: 80,
                type: 'SHARED',
                category: 'RECURRING',
                frequency: 'MONTHLY',
            },
        },
    });

    // 2. Alex proposes EDITING groceries from €450 to €500
    await prisma.expenseApproval.create({
        data: {
            expenseId: sharedExpenses.groceriesId,
            householdId,
            action: 'UPDATE',
            status: 'PENDING',
            requestedById: alexId,
            proposedData: {
                name: 'Groceries',
                amount: 500,
                type: 'SHARED',
                category: 'RECURRING',
                frequency: 'MONTHLY',
            },
        },
    });

    // 3. Sam proposes a shared savings withdrawal
    await prisma.expenseApproval.create({
        data: {
            householdId,
            action: 'WITHDRAW_SAVINGS',
            status: 'PENDING',
            requestedById: samId,
            proposedData: {
                amount: 150,
                month: CURRENT_MONTH,
                year: CURRENT_YEAR,
                reason: 'Emergency car repair',
            },
        },
    });
}

async function createSettlements(
    prisma: PrismaClient,
    alexId: string,
    samId: string,
    householdId: string,
): Promise<void> {
    // Previous month settlement — Sam owed Alex €125
    await prisma.settlement.create({
        data: {
            householdId,
            month: PREV_MONTH,
            year: PREV_YEAR,
            amount: 125,
            paidByUserId: samId,
            paidToUserId: alexId,
        },
    });
    // Current month left unsettled so employer can try it
}

main().catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
});
