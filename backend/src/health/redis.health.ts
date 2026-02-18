import { Inject, Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
    constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
        super();
    }

    async isHealthy(key: string): Promise<HealthIndicatorResult> {
        try {
            const result = await this.redis.ping();
            const isHealthy = result === 'PONG';
            if (!isHealthy) {
                throw new HealthCheckError(
                    'Redis health check failed',
                    this.getStatus(key, false, { message: `Unexpected ping response: ${result}` }),
                );
            }
            return this.getStatus(key, true);
        } catch (error) {
            if (error instanceof HealthCheckError) throw error;
            throw new HealthCheckError(
                'Redis health check failed',
                this.getStatus(key, false, { message: (error as Error).message }),
            );
        }
    }
}
