import {ThrottlerStorage} from '@nestjs/throttler';
import Redis from 'ioredis';

interface ThrottlerResponse {
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
}

export class ThrottlerRedisStorage implements ThrottlerStorage {
    constructor(private readonly redis: Redis) {
    }

    async increment(key: string, ttl: number, limit: number, blockDuration: number, _throttlerName: string): Promise<ThrottlerResponse> {
        const blockKey = `${key}:blocked`;
        const blockedTTL = await this.redis.pttl(blockKey); // Check if already blocked

        if (blockedTTL > 0) return this.buildResponse(limit + 1, true, blockedTTL);

        const totalHits = await this.redis.incr(key);
        if (totalHits === 1) await this.redis.pexpire(key, ttl);

        // Exceeded limit? Set block
        if (totalHits > limit && blockDuration > 0) {
            await this.redis.set(blockKey, '1', 'PX', blockDuration);
            await this.redis.del(key);
            return this.buildResponse(totalHits, true, blockDuration);
        }

        const timeToExpire = await this.redis.pttl(key);
        return this.buildResponse(totalHits, false, timeToExpire);
    }

    private buildResponse(totalHits: number, blocked: boolean, timeValue: number): ThrottlerResponse {
        return {
            totalHits,
            timeToExpire: blocked ? 0 : Math.max(0, timeValue),
            isBlocked: blocked,
            timeToBlockExpire: blocked ? timeValue : 0,
        };
    }
}