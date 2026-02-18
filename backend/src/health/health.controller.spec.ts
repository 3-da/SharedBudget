import { Test } from '@nestjs/testing';
import { HealthCheckService } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './prisma.health';
import { RedisHealthIndicator } from './redis.health';

describe('HealthController', () => {
    let controller: HealthController;
    let healthService: { check: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
        healthService = { check: vi.fn() };

        const module = await Test.createTestingModule({
            controllers: [HealthController],
            providers: [
                { provide: HealthCheckService, useValue: healthService },
                { provide: PrismaHealthIndicator, useValue: { isHealthy: vi.fn() } },
                { provide: RedisHealthIndicator, useValue: { isHealthy: vi.fn() } },
            ],
        }).compile();

        controller = module.get(HealthController);
    });

    describe('check', () => {
        it('should return health check result when all services are healthy', async () => {
            const mockResult = {
                status: 'ok',
                info: { database: { status: 'up' }, redis: { status: 'up' } },
                error: {},
                details: { database: { status: 'up' }, redis: { status: 'up' } },
            };
            healthService.check.mockResolvedValue(mockResult);

            const result = await controller.check();

            expect(result).toBe(mockResult);
            expect(healthService.check).toHaveBeenCalledWith([expect.any(Function), expect.any(Function)]);
        });

        it('should propagate errors from HealthCheckService', async () => {
            healthService.check.mockRejectedValue(new Error('Service down'));

            await expect(controller.check()).rejects.toThrow('Service down');
        });
    });
});
