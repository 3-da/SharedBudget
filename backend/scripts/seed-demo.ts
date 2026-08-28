import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { ApprovalAction, ApprovalStatus, ExpenseCategory, ExpenseFrequency, ExpenseType, HouseholdRole } from '../src/generated/prisma/enums.js';
import { DEMO_ACCOUNT_EMAILS, DEMO_ACCOUNT_PASSWORD, DEMO_HOUSEHOLD_INVITE_CODE, DEMO_HOUSEHOLD_NAME } from '../src/demo-data/demo-seed.constants.js';
import { buildDemoMonthPeriods, getDemoReferenceDate } from '../src/demo-data/demo-month-periods.js';
import { buildDemoSalaryRows, buildDemoSavingRows } from '../src/demo-data/demo-seed-data.js';

interface DemoUserIds {
    alexUserId: string;
    samUserId: string;
    jordanUserId: string;
}

interface DemoExpenseIds {
    groceriesExpenseId: string;
}

interface SharedDemoExpenses {
    expenses: Awaited<ReturnType<typeof createRecurringExpense>>[];
    groceriesExpenseId: string;
}

const DEMO_USER_IDENTITIES = [
    { email: DEMO_ACCOUNT_EMAILS[0], firstName: 'Alex', lastName: 'Demo' },
    { email: DEMO_ACCOUNT_EMAILS[1], firstName: 'Sam', lastName: 'Demo' },
    { email: DEMO_ACCOUNT_EMAILS[2], firstName: 'Jordan', lastName: 'Demo' },
];

async function seedDemoData(): Promise<void> {
    const databaseUrl = getRequiredDatabaseUrl();
    const prismaClient = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

    try {
        await prismaClient.$connect();
        await replaceDemoData(prismaClient);
    } finally {
        await prismaClient.$disconnect();
    }
}

async function replaceDemoData(prismaClient: PrismaClient): Promise<void> {
    const demoReferenceDate = getDemoReferenceDate(process.env.DEMO_REFERENCE_MONTH);
    const demoMonthPeriods = buildDemoMonthPeriods(demoReferenceDate);

    await deleteExistingDemoData(prismaClient);
    const demoUserIds = await createDemoUsers(prismaClient);
    const householdId = await createDemoHousehold(prismaClient, demoUserIds);
    await createDemoFinancialHistory(prismaClient, demoUserIds, householdId, demoMonthPeriods);
    const demoExpenseIds = await createDemoExpenses(prismaClient, demoUserIds, householdId, demoMonthPeriods[0]);
    await createDemoApprovals(prismaClient, demoUserIds, householdId, demoExpenseIds, demoMonthPeriods[11]);
    await createDemoSettlement(prismaClient, demoUserIds, householdId, demoMonthPeriods[10]);
    printDemoSeedSummary(demoMonthPeriods[11]);
}

async function deleteExistingDemoData(prismaClient: PrismaClient): Promise<void> {
    const demoUsers = await prismaClient.user.findMany({ where: { email: { in: [...DEMO_ACCOUNT_EMAILS] } }, select: { id: true } });
    const demoUserIds = demoUsers.map((demoUser) => demoUser.id);
    if (demoUserIds.length === 0) {
        return;
    }

    const demoHousehold = await prismaClient.household.findUnique({ where: { inviteCode: DEMO_HOUSEHOLD_INVITE_CODE }, select: { id: true } });
    await prismaClient.householdInvitation.deleteMany({ where: { OR: [{ senderId: { in: demoUserIds } }, { targetUserId: { in: demoUserIds } }] } });
    if (demoHousehold) {
        await prismaClient.household.delete({ where: { id: demoHousehold.id } });
    }

    await prismaClient.user.deleteMany({ where: { id: { in: demoUserIds } } });
}

async function createDemoUsers(prismaClient: PrismaClient): Promise<DemoUserIds> {
    const passwordHash = await argon2.hash(DEMO_ACCOUNT_PASSWORD);
    const demoUsers = await Promise.all(
        DEMO_USER_IDENTITIES.map((demoUserIdentity) =>
            prismaClient.user.create({
                data: { ...demoUserIdentity, password: passwordHash, emailVerified: true },
            }),
        ),
    );

    return { alexUserId: demoUsers[0].id, samUserId: demoUsers[1].id, jordanUserId: demoUsers[2].id };
}

async function createDemoHousehold(prismaClient: PrismaClient, demoUserIds: DemoUserIds): Promise<string> {
    const household = await prismaClient.household.create({
        data: {
            name: DEMO_HOUSEHOLD_NAME,
            inviteCode: DEMO_HOUSEHOLD_INVITE_CODE,
            members: {
                create: [
                    { userId: demoUserIds.alexUserId, role: HouseholdRole.OWNER },
                    { userId: demoUserIds.samUserId, role: HouseholdRole.MEMBER },
                ],
            },
        },
    });

    return household.id;
}

async function createDemoFinancialHistory(
    prismaClient: PrismaClient,
    demoUserIds: DemoUserIds,
    householdId: string,
    demoMonthPeriods: ReturnType<typeof buildDemoMonthPeriods>,
): Promise<void> {
    const salaryRows = buildDemoSalaryRows(demoUserIds.alexUserId, demoUserIds.samUserId, householdId, demoMonthPeriods);
    const savingRows = buildDemoSavingRows(demoUserIds.alexUserId, demoUserIds.samUserId, householdId, demoMonthPeriods);

    await prismaClient.salary.createMany({ data: salaryRows });
    await prismaClient.saving.createMany({ data: savingRows });
}

async function createDemoExpenses(
    prismaClient: PrismaClient,
    demoUserIds: DemoUserIds,
    householdId: string,
    firstDemoMonthPeriod: { month: number; year: number },
): Promise<DemoExpenseIds> {
    const recurringExpensesStartedAt = new Date(firstDemoMonthPeriod.year, firstDemoMonthPeriod.month - 1, 1);
    await createPersonalDemoExpenses(prismaClient, demoUserIds, householdId, recurringExpensesStartedAt);
    const sharedDemoExpenses = await createSharedDemoExpenses(prismaClient, demoUserIds, householdId, recurringExpensesStartedAt);
    await acceptSharedDemoExpenses(prismaClient, demoUserIds, householdId, sharedDemoExpenses.expenses);

    return { groceriesExpenseId: sharedDemoExpenses.groceriesExpenseId };
}

async function createPersonalDemoExpenses(prismaClient: PrismaClient, demoUserIds: DemoUserIds, householdId: string, createdAt: Date): Promise<void> {
    await prismaClient.expense.createMany({
        data: [
            buildRecurringExpense(householdId, demoUserIds.alexUserId, 'Gym membership', 45, ExpenseType.PERSONAL, createdAt),
            buildRecurringExpense(householdId, demoUserIds.alexUserId, 'Music subscription', 12, ExpenseType.PERSONAL, createdAt),
            buildRecurringExpense(householdId, demoUserIds.samUserId, 'Yoga studio', 60, ExpenseType.PERSONAL, createdAt),
            buildRecurringExpense(householdId, demoUserIds.samUserId, 'Train pass', 89, ExpenseType.PERSONAL, createdAt),
        ],
    });
}

async function createSharedDemoExpenses(
    prismaClient: PrismaClient,
    demoUserIds: DemoUserIds,
    householdId: string,
    createdAt: Date,
): Promise<SharedDemoExpenses> {
    const [rentExpense, groceriesExpense, electricityExpense, internetExpense] = await Promise.all([
        createRecurringExpense(prismaClient, householdId, demoUserIds.alexUserId, 'Rent', 1400, createdAt),
        createRecurringExpense(prismaClient, householdId, demoUserIds.samUserId, 'Groceries', 450, createdAt),
        createRecurringExpense(prismaClient, householdId, demoUserIds.alexUserId, 'Electricity', 120, createdAt),
        createRecurringExpense(prismaClient, householdId, demoUserIds.samUserId, 'Internet', 45, createdAt),
    ]);

    return { expenses: [rentExpense, groceriesExpense, electricityExpense, internetExpense], groceriesExpenseId: groceriesExpense.id };
}

async function createRecurringExpense(prismaClient: PrismaClient, householdId: string, createdById: string, name: string, amount: number, createdAt: Date) {
    return prismaClient.expense.create({ data: buildRecurringExpense(householdId, createdById, name, amount, ExpenseType.SHARED, createdAt) });
}

function buildRecurringExpense(
    householdId: string,
    createdById: string,
    name: string,
    amount: number,
    expenseType: (typeof ExpenseType)[keyof typeof ExpenseType],
    createdAt: Date,
) {
    return { householdId, createdById, name, amount, type: expenseType, category: ExpenseCategory.RECURRING, frequency: ExpenseFrequency.MONTHLY, createdAt };
}

async function acceptSharedDemoExpenses(
    prismaClient: PrismaClient,
    demoUserIds: DemoUserIds,
    householdId: string,
    sharedExpenses: SharedDemoExpenses['expenses'],
): Promise<void> {
    const acceptedApprovalRows = sharedExpenses.map((sharedExpense) => ({
        expenseId: sharedExpense.id,
        householdId,
        action: ApprovalAction.CREATE,
        status: ApprovalStatus.ACCEPTED,
        requestedById: sharedExpense.createdById,
        reviewedById: getOtherDemoMemberId(sharedExpense.createdById, demoUserIds),
        reviewedAt: new Date(),
    }));

    await prismaClient.expenseApproval.createMany({ data: acceptedApprovalRows });
}

async function createDemoApprovals(
    prismaClient: PrismaClient,
    demoUserIds: DemoUserIds,
    householdId: string,
    demoExpenseIds: DemoExpenseIds,
    currentDemoMonthPeriod: { month: number; year: number },
): Promise<void> {
    await prismaClient.expenseApproval.createMany({
        data: [
            buildNewExpenseApproval(demoUserIds.samUserId, householdId),
            buildExpenseUpdateApproval(demoUserIds.alexUserId, householdId, demoExpenseIds.groceriesExpenseId),
            buildSavingsWithdrawalApproval(demoUserIds.samUserId, householdId, currentDemoMonthPeriod),
        ],
    });
}

function buildNewExpenseApproval(requestedById: string, householdId: string) {
    return {
        householdId,
        action: ApprovalAction.CREATE,
        status: ApprovalStatus.PENDING,
        requestedById,
        proposedData: {
            name: 'Cleaning service',
            amount: 80,
            type: ExpenseType.SHARED,
            category: ExpenseCategory.RECURRING,
            frequency: ExpenseFrequency.MONTHLY,
        },
    };
}

function buildExpenseUpdateApproval(requestedById: string, householdId: string, expenseId: string) {
    return {
        expenseId,
        householdId,
        action: ApprovalAction.UPDATE,
        status: ApprovalStatus.PENDING,
        requestedById,
        proposedData: { name: 'Groceries', amount: 500, type: ExpenseType.SHARED, category: ExpenseCategory.RECURRING, frequency: ExpenseFrequency.MONTHLY },
    };
}

function buildSavingsWithdrawalApproval(requestedById: string, householdId: string, currentDemoMonthPeriod: { month: number; year: number }) {
    return {
        householdId,
        action: ApprovalAction.WITHDRAW_SAVINGS,
        status: ApprovalStatus.PENDING,
        requestedById,
        proposedData: { amount: 150, ...currentDemoMonthPeriod, reason: 'Emergency car repair' },
    };
}

async function createDemoSettlement(
    prismaClient: PrismaClient,
    demoUserIds: DemoUserIds,
    householdId: string,
    previousDemoMonthPeriod: { month: number; year: number },
): Promise<void> {
    await prismaClient.settlement.create({
        data: {
            householdId,
            ...previousDemoMonthPeriod,
            amount: 125,
            paidByUserId: demoUserIds.samUserId,
            paidToUserId: demoUserIds.alexUserId,
        },
    });
}

function getOtherDemoMemberId(requestingUserId: string, demoUserIds: DemoUserIds): string {
    return requestingUserId === demoUserIds.alexUserId ? demoUserIds.samUserId : demoUserIds.alexUserId;
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
