export interface DemoMonthPeriod {
    month: number;
    year: number;
}

const DEMO_HISTORY_MONTH_COUNT = 12;

export function buildDemoMonthPeriods(referenceDate: Date): DemoMonthPeriod[] {
    return Array.from({ length: DEMO_HISTORY_MONTH_COUNT }, (_, periodIndex) => {
        const monthsBeforeReference = DEMO_HISTORY_MONTH_COUNT - periodIndex - 1;
        const periodDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - monthsBeforeReference, 1);

        return { month: periodDate.getMonth() + 1, year: periodDate.getFullYear() };
    });
}

export function getDemoReferenceDate(configuredReferenceMonth?: string): Date {
    if (!configuredReferenceMonth) {
        return new Date();
    }

    const referenceMonthMatch = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(configuredReferenceMonth);
    if (!referenceMonthMatch) {
        throw new Error('DEMO_REFERENCE_MONTH must use YYYY-MM format');
    }

    return new Date(Number(referenceMonthMatch[1]), Number(referenceMonthMatch[2]) - 1, 15);
}
