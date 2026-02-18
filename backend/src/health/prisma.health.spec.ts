import { Test } from '@nestjs/testing';
import { HealthCheckError } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma.health';
import { PrismaService } from '../prisma/prisma.service';

describe('PrismaHealthIndicator', () => {
    let indicator: PrismaHealthIndicator;
    let prisma: { $queryRaw: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
        prisma = { $queryRaw: vi.fn() };

        const module = await Test.createTestingModule({
            providers: [
                PrismaHealthIndicator,
                { provide: PrismaService, useValue: prisma },
            ],
        }).compile();

        indicator = module.get(PrismaHealthIndicator);
    });

    describe('isHealthy', () => {
        it('should return healthy status when database query succeeds', async () => {
            prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

            const result = await indicator.isHealthy('database');

            expect(result).toEqual({ database: { status: 'up' } });
        });

        it('should throw HealthCheckError when database query fails', async () => {
            prisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

            await expect(indicator.isHealthy('database')).rejects.toThrow(HealthCheckError);
            await expect(indicator.isHealthy('database')).rejects.toThrow('Database health check failed');
        });

        it('should include error message in the unhealthy status', async () => {
            prisma.$queryRaw.mockRejectedValue(new Error('ECONNREFUSED'));

            try {
                await indicator.isHealthy('database');
                expect.fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(HealthCheckError);
                const healthError = error as HealthCheckError;
                expect(healthError.causes).toMatchObject({
                    database: { status: 'down', message: 'ECONNREFUSED' },
                });
            }
        });
    });
});
