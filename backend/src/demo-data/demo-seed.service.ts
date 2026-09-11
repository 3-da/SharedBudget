import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getCurrentDemoMonthPeriod } from './demo-month-periods';
import { hasSalaryDataForMonth, replaceDemoData } from './demo-seed.core';

@Injectable()
export class DemoSeedService {
    private readonly logger = new Logger(DemoSeedService.name);

    constructor(private readonly prisma: PrismaService) {}

    async isCurrentMonthSeeded(): Promise<boolean> {
        const currentDemoMonthPeriod = getCurrentDemoMonthPeriod(new Date());
        return hasSalaryDataForMonth(this.prisma, currentDemoMonthPeriod);
    }

    async reseedDemoData(): Promise<void> {
        const seededThroughMonthPeriod = await replaceDemoData(this.prisma, new Date());
        this.logSeedCompletion(seededThroughMonthPeriod);
    }

    private logSeedCompletion(seededThroughMonthPeriod: { month: number; year: number }): void {
        const monthLabel = `${seededThroughMonthPeriod.year}-${String(seededThroughMonthPeriod.month).padStart(2, '0')}`;
        this.logger.log(`Demo household data reset through ${monthLabel}`);
    }
}
