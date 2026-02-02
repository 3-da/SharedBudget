import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT } from '../redis/redis.module';
import Redis from 'ioredis';

@Injectable()
export class SessionService {
    private readonly logger = new Logger(SessionService.name);

    private readonly refreshTokenTTL: number;

    constructor(
        @Inject(REDIS_CLIENT) private readonly redis: Redis,
        private readonly configService: ConfigService,
    ) {
        this.refreshTokenTTL = this.configService.get<number>('AUTH_REFRESH_TOKEN_TTL', 604800);
    }

    /**
     * Stores a refresh token in Redis mapped to a userId, and tracks it
     * in the user's session set for bulk invalidation.
     *
     * @param userId - The user who owns this token
     * @param token - The opaque refresh token string
     */
    async storeRefreshToken(userId: string, token: string): Promise<void> {
        await this.redis.set(`refresh:${token}`, userId, 'EX', this.refreshTokenTTL);
        await this.redis.sadd(`user_sessions:${userId}`, token);
        await this.redis.expire(`user_sessions:${userId}`, this.refreshTokenTTL);
        this.logger.debug(`Stored refresh token for user: ${userId}`);
    }

    /**
     * Looks up which userId a refresh token belongs to.
     *
     * @param token - The opaque refresh token string
     * @returns The userId, or null if the token is expired/invalid
     */
    async getUserIdFromRefreshToken(token: string): Promise<string | null> {
        return this.redis.get(`refresh:${token}`);
    }

    /**
     * Removes a single refresh token from Redis and from its owner's session set.
     *
     * @param token - The opaque refresh token to remove
     * @returns The userId that owned the token, or null if it was already gone
     */
    async removeRefreshToken(token: string): Promise<string | null> {
        const userId = await this.redis.get(`refresh:${token}`);
        await this.redis.del(`refresh:${token}`);

        if (userId) await this.redis.srem(`user_sessions:${userId}`, token);

        return userId;
    }

    /**
     * Invalidates every active session for a user by deleting all their
     * refresh tokens and the session tracking set.
     *
     * Use case: Called after password change or password reset to force
     * re-authentication on all devices.
     *
     * @param userId - The user whose sessions should be invalidated
     * @returns The number of sessions that were invalidated
     */
    async invalidateAllSessions(userId: string): Promise<number> {
        const tokens = await this.redis.smembers(`user_sessions:${userId}`);

        if (tokens.length === 0) return 0;

        const pipeline = this.redis.pipeline();
        for (const token of tokens) {
            pipeline.del(`refresh:${token}`);
        }
        pipeline.del(`user_sessions:${userId}`);

        await pipeline.exec();

        this.logger.log(`Invalidated ${tokens.length} sessions for user: ${userId}`);
        return tokens.length;
    }
}
