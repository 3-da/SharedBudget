import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT } from '../redis/redis.module';
import Redis from 'ioredis';
import * as crypto from 'crypto';

export interface StoredSession {
    userId: string;
    uaHash: string | null;
}

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
     * Stores a refresh token in Redis mapped to a userId and user-agent hash,
     * and tracks it in the user's session set for bulk invalidation.
     *
     * @param userId - The user who owns this token
     * @param token - The opaque refresh token string
     * @param userAgent - Optional user-agent string for device binding
     */
    async storeRefreshToken(userId: string, token: string, userAgent?: string): Promise<void> {
        const uaHash = userAgent ? this.hashUserAgent(userAgent) : null;
        const value = JSON.stringify({ userId, uaHash });

        const pipeline = this.redis.pipeline();
        pipeline.set(`refresh:${token}`, value, 'EX', this.refreshTokenTTL);
        pipeline.sadd(`user_sessions:${userId}`, token);
        pipeline.expire(`user_sessions:${userId}`, this.refreshTokenTTL);
        await pipeline.exec();
        this.logger.debug(`Stored refresh token for user: ${userId}`);
    }

    /**
     * Looks up which userId a refresh token belongs to, along with the stored
     * user-agent hash for device binding verification.
     *
     * Graceful migration: if the stored value is a plain string (old format),
     * returns it as userId with null uaHash.
     *
     * @param token - The opaque refresh token string
     * @returns The session info, or null if the token is expired/invalid
     */
    async getSessionFromRefreshToken(token: string): Promise<StoredSession | null> {
        const value = await this.redis.get(`refresh:${token}`);
        if (!value) return null;

        try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === 'object' && parsed.userId) {
                return { userId: parsed.userId, uaHash: parsed.uaHash ?? null };
            }
        } catch {
            // Old format: plain userId string — graceful migration
        }

        return { userId: value, uaHash: null };
    }

    /**
     * @deprecated Use getSessionFromRefreshToken instead. Kept for backward compatibility.
     */
    async getUserIdFromRefreshToken(token: string): Promise<string | null> {
        const session = await this.getSessionFromRefreshToken(token);
        return session?.userId ?? null;
    }

    /**
     * Removes a single refresh token from Redis and from its owner's session set.
     *
     * @param token - The opaque refresh token to remove
     * @returns The userId that owned the token, or null if it was already gone
     */
    async removeRefreshToken(token: string): Promise<string | null> {
        const session = await this.getSessionFromRefreshToken(token);
        const userId = session?.userId ?? null;

        const pipeline = this.redis.pipeline();
        pipeline.del(`refresh:${token}`);
        if (userId) pipeline.srem(`user_sessions:${userId}`, token);
        await pipeline.exec();

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

    /**
     * Hashes a user-agent string into a short fingerprint for device binding.
     */
    hashUserAgent(userAgent: string): string {
        return crypto.createHash('sha256').update(userAgent).digest('hex').slice(0, 16);
    }
}
