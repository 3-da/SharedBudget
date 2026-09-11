import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DemoSeedScheduler } from './demo-seed.scheduler';
import { DemoSeedService } from './demo-seed.service';

describe('DemoSeedScheduler', () => {
    let scheduler: DemoSeedScheduler;
    let demoSeedService: { isCurrentMonthSeeded: ReturnType<typeof vi.fn>; reseedDemoData: ReturnType<typeof vi.fn> };
    let configService: { get: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
        demoSeedService = { isCurrentMonthSeeded: vi.fn(), reseedDemoData: vi.fn() };
        configService = { get: vi.fn() };

        const module = await Test.createTestingModule({
            providers: [DemoSeedScheduler, { provide: DemoSeedService, useValue: demoSeedService }, { provide: ConfigService, useValue: configService }],
        }).compile();

        scheduler = module.get(DemoSeedScheduler);
    });

    describe('onApplicationBootstrap', () => {
        it('should do nothing outside production', async () => {
            configService.get.mockReturnValue('development');

            await scheduler.onApplicationBootstrap();

            expect(demoSeedService.isCurrentMonthSeeded).not.toHaveBeenCalled();
            expect(demoSeedService.reseedDemoData).not.toHaveBeenCalled();
        });

        it('should skip reseeding in production when the current month is already seeded', async () => {
            configService.get.mockReturnValue('production');
            demoSeedService.isCurrentMonthSeeded.mockResolvedValue(true);

            await scheduler.onApplicationBootstrap();

            expect(demoSeedService.reseedDemoData).not.toHaveBeenCalled();
        });

        it('should reseed in production when the current month has no salary data yet', async () => {
            configService.get.mockReturnValue('production');
            demoSeedService.isCurrentMonthSeeded.mockResolvedValue(false);

            await scheduler.onApplicationBootstrap();

            expect(demoSeedService.reseedDemoData).toHaveBeenCalledTimes(1);
        });
    });

    describe('handleMonthlyReseed', () => {
        it('should do nothing outside production', async () => {
            configService.get.mockReturnValue('development');

            await scheduler.handleMonthlyReseed();

            expect(demoSeedService.reseedDemoData).not.toHaveBeenCalled();
        });

        it('should unconditionally reseed in production', async () => {
            configService.get.mockReturnValue('production');

            await scheduler.handleMonthlyReseed();

            expect(demoSeedService.reseedDemoData).toHaveBeenCalledTimes(1);
        });
    });
});
