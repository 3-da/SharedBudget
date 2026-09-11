import { Test } from '@nestjs/testing';
import { DemoSeedService } from './demo-seed.service';
import { PrismaService } from '../prisma/prisma.service';
import * as demoSeedCore from './demo-seed.core';

vi.mock('./demo-seed.core');

describe('DemoSeedService', () => {
    let service: DemoSeedService;
    const prisma = {} as PrismaService;

    beforeEach(async () => {
        vi.clearAllMocks();

        const module = await Test.createTestingModule({
            providers: [DemoSeedService, { provide: PrismaService, useValue: prisma }],
        }).compile();

        service = module.get(DemoSeedService);
    });

    describe('isCurrentMonthSeeded', () => {
        it('should return true when the demo household has salary data for the current month', async () => {
            vi.mocked(demoSeedCore.hasSalaryDataForMonth).mockResolvedValue(true);

            const result = await service.isCurrentMonthSeeded();

            expect(result).toBe(true);
            expect(demoSeedCore.hasSalaryDataForMonth).toHaveBeenCalledWith(prisma, { month: expect.any(Number), year: expect.any(Number) });
        });

        it('should return false when the demo household has no salary data for the current month', async () => {
            vi.mocked(demoSeedCore.hasSalaryDataForMonth).mockResolvedValue(false);

            const result = await service.isCurrentMonthSeeded();

            expect(result).toBe(false);
        });
    });

    describe('reseedDemoData', () => {
        it('should replace the demo data using the injected Prisma client and the current date', async () => {
            vi.mocked(demoSeedCore.replaceDemoData).mockResolvedValue({ month: 9, year: 2026 });

            await service.reseedDemoData();

            expect(demoSeedCore.replaceDemoData).toHaveBeenCalledWith(prisma, expect.any(Date));
        });
    });
});
