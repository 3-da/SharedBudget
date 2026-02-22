import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
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
                // Return a failed status instead of throwing an exception that's caught locally
                return this.getStatus(key, false, { message: `Unexpected ping response: ${result}` });
            }
            return this.getStatus(key, true);
        } catch (error) {
            return this.getStatus(key, false, { message: (error as Error).message });
        }
    }
}
