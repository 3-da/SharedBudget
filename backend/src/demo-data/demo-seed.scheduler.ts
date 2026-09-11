import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DemoSeedService } from './demo-seed.service';

/**
 * Keeps the recruiter-facing demo household self-healing so nobody ever opens
 * it to a month with expenses but no income.
 *
 * Use case: `replaceDemoData` seeds a rolling twelve-month window ending "now"
 * at the moment it runs, but salary/savings rows stay pinned to that window
 * while recurring expenses keep applying forever — so the window goes stale
 * the moment the calendar rolls past it. This scheduler re-runs the seed
 * on every deploy/restart when that has already happened, and again on the
 * 1st of each month regardless, so a stale window never survives for long
 * even if the app keeps running without a restart.
 *
 * Runs only in production — local and CI databases are never touched.
 */
@Injectable()
export class DemoSeedScheduler implements OnApplicationBootstrap {
    private readonly logger = new Logger(DemoSeedScheduler.name);

    constructor(
        private readonly demoSeedService: DemoSeedService,
        private readonly configService: ConfigService,
    ) {}

    async onApplicationBootstrap(): Promise<void> {
        if (!this.isEnabled()) {
            return;
        }

        const isCurrentMonthSeeded = await this.demoSeedService.isCurrentMonthSeeded();
        if (isCurrentMonthSeeded) {
            return;
        }

        this.logger.warn('Demo data is stale for the current month — reseeding on boot');
        await this.demoSeedService.reseedDemoData();
    }

    @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
    async handleMonthlyReseed(): Promise<void> {
        if (!this.isEnabled()) {
            return;
        }

        this.logger.log('Monthly demo data reseed triggered');
        await this.demoSeedService.reseedDemoData();
    }

    private isEnabled(): boolean {
        return this.configService.get<string>('NODE_ENV') === 'production';
    }
}
