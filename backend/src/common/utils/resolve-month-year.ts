/**
 * Resolves month and year from optional parameters, defaulting to the current period.
 * Used across services that operate on monthly data (expenses, savings, salaries, dashboard).
 */
export function resolveMonthYear(reqMonth?: number, reqYear?: number): { month: number; year: number } {
    const now = new Date();
    return {
        month: reqMonth ?? now.getMonth() + 1,
        year: reqYear ?? now.getFullYear(),
    };
}
