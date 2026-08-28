import { DemoMonthPeriod } from './demo-month-periods';

const ALEX_MONTHLY_PERSONAL_SAVINGS = [180, 220, 210, 260, 240, 300, 320, 290, 350, 380, 410, 450];
const ALEX_MONTHLY_SHARED_SAVINGS = [120, 140, 130, 160, 150, 180, 190, 170, 210, 220, 240, 260];
const SAM_MONTHLY_PERSONAL_SAVINGS = [130, 150, 170, 160, 190, 210, 200, 230, 250, 270, 290, 320];
const SAM_MONTHLY_SHARED_SAVINGS = [100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 220];
const ALEX_MONTHLY_SALARIES = [4500, 4500, 4500, 4650, 4500, 4500, 4700, 4500, 4500, 4800, 4500, 4800];
const SAM_MONTHLY_SALARIES = [3200, 3200, 3350, 3200, 3200, 3400, 3200, 3200, 3500, 3200, 3200, 3350];

interface DemoSavingRow {
    userId: string;
    householdId: string;
    amount: number;
    month: number;
    year: number;
    isShared: boolean;
    reducesFromSalary: boolean;
}

interface DemoSalaryRow {
    userId: string;
    householdId: string;
    defaultAmount: number;
    currentAmount: number;
    month: number;
    year: number;
}

export function buildDemoSavingRows(alexUserId: string, samUserId: string, householdId: string, demoMonthPeriods: DemoMonthPeriod[]): DemoSavingRow[] {
    return demoMonthPeriods.flatMap((demoMonthPeriod, periodIndex) => [
        buildDemoSavingRow(alexUserId, householdId, demoMonthPeriod, ALEX_MONTHLY_PERSONAL_SAVINGS[periodIndex], false),
        buildDemoSavingRow(alexUserId, householdId, demoMonthPeriod, ALEX_MONTHLY_SHARED_SAVINGS[periodIndex], true),
        buildDemoSavingRow(samUserId, householdId, demoMonthPeriod, SAM_MONTHLY_PERSONAL_SAVINGS[periodIndex], false),
        buildDemoSavingRow(samUserId, householdId, demoMonthPeriod, SAM_MONTHLY_SHARED_SAVINGS[periodIndex], true),
    ]);
}

export function buildDemoSalaryRows(alexUserId: string, samUserId: string, householdId: string, demoMonthPeriods: DemoMonthPeriod[]): DemoSalaryRow[] {
    return demoMonthPeriods.flatMap((demoMonthPeriod, periodIndex) => [
        buildDemoSalaryRow(alexUserId, householdId, demoMonthPeriod, 4500, ALEX_MONTHLY_SALARIES[periodIndex]),
        buildDemoSalaryRow(samUserId, householdId, demoMonthPeriod, 3200, SAM_MONTHLY_SALARIES[periodIndex]),
    ]);
}

function buildDemoSavingRow(userId: string, householdId: string, demoMonthPeriod: DemoMonthPeriod, amount: number, isShared: boolean): DemoSavingRow {
    return { userId, householdId, ...demoMonthPeriod, amount, isShared, reducesFromSalary: true };
}

function buildDemoSalaryRow(
    userId: string,
    householdId: string,
    demoMonthPeriod: DemoMonthPeriod,
    defaultAmount: number,
    currentAmount: number,
): DemoSalaryRow {
    return { userId, householdId, ...demoMonthPeriod, defaultAmount, currentAmount };
}
