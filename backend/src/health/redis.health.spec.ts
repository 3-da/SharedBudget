import { Test } from '@nestjs/testing';
import { HealthCheckError } from '@nestjs/terminus';
import { RedisHealthIndicator } from './redis.health';
import { REDIS_CLIENT } from '../redis/redis.module';

describe('RedisHealthIndicator', () => {
    let indicator: RedisHealthIndicator;
    let redis: { ping: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
        redis = { ping: vi.fn() };

        const module = await Test.createTestingModule({
            providers: [
                RedisHealthIndicator,
                { provide: REDIS_CLIENT, useValue: redis },
            ],
        }).compile();

        indicator = module.get(RedisHealthIndicator);
    });

    describe('isHealthy', () => {
        it('should return healthy status when ping returns PONG', async () => {
            redis.ping.mockResolvedValue('PONG');

            const result = await indicator.isHealthy('redis');

            expect(result).toEqual({ redis: { status: 'up' } });
        });

        it('should throw HealthCheckError when ping returns unexpected response', async () => {
            redis.ping.mockResolvedValue('ERROR');

            await expect(indicator.isHealthy('redis')).rejects.toThrow(HealthCheckError);
            await expect(indicator.isHealthy('redis')).rejects.toThrow('Redis health check failed');
        });

        it('should throw HealthCheckError when ping throws', async () => {
            redis.ping.mockRejectedValue(new Error('ECONNRESET'));

            await expect(indicator.isHealthy('redis')).rejects.toThrow(HealthCheckError);
            await expect(indicator.isHealthy('redis')).rejects.toThrow('Redis health check failed');
        });

        it('should include error message when ping throws', async () => {
            redis.ping.mockRejectedValue(new Error('ETIMEDOUT'));

            try {
                await indicator.isHealthy('redis');
                expect.fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(HealthCheckError);
                const healthError = error as HealthCheckError;
                expect(healthError.causes).toMatchObject({
                    redis: { status: 'down', message: 'ETIMEDOUT' },
                });
            }
        });
    });
});
