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
            if (result !== 'PONG') {
                const status = this.getStatus(key, false, { message: `Unexpected ping response: ${result}` });
                throw new HealthCheckError('Redis health check failed', status);
            }
            return this.getStatus(key, true);
        } catch (error) {
            if (error instanceof HealthCheckError) throw error;
            const status = this.getStatus(key, false, { message: (error as Error).message });
            throw new HealthCheckError('Redis health check failed', status);
        }
    }
}
