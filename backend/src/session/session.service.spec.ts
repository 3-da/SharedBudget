import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SessionService } from './session.service';
import { REDIS_CLIENT } from '../redis/redis.module';

describe('SessionService', () => {
    let sessionService: SessionService;

    const userId = 'user-123';
    const token = 'refresh-token-abc';

    const mockPipeline = {
        del: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
    };

    const mockRedis = {
        get: vi.fn(),
        set: vi.fn(),
        del: vi.fn(),
        sadd: vi.fn(),
        srem: vi.fn(),
        expire: vi.fn(),
        smembers: vi.fn().mockResolvedValue([]),
        pipeline: vi.fn(() => mockPipeline),
    };

    const mockConfigService = {
        get: vi.fn().mockReturnValue(604800),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SessionService,
                { provide: REDIS_CLIENT, useValue: mockRedis },
                { provide: ConfigService, useValue: mockConfigService },
            ],
        }).compile();

        sessionService = module.get<SessionService>(SessionService);

        vi.clearAllMocks();
    });

    describe('storeRefreshToken', () => {
        it('should store token in Redis with TTL and add to session set', async () => {
            await sessionService.storeRefreshToken(userId, token);

            expect(mockRedis.set).toHaveBeenCalledWith(`refresh:${token}`, userId, 'EX', 604800);
            expect(mockRedis.sadd).toHaveBeenCalledWith(`user_sessions:${userId}`, token);
            expect(mockRedis.expire).toHaveBeenCalledWith(`user_sessions:${userId}`, 604800);
        });

        it('should refresh session set TTL on every new token', async () => {
            await sessionService.storeRefreshToken(userId, 'token-1');
            await sessionService.storeRefreshToken(userId, 'token-2');

            expect(mockRedis.expire).toHaveBeenCalledTimes(2);
            expect(mockRedis.expire).toHaveBeenNthCalledWith(1, `user_sessions:${userId}`, 604800);
            expect(mockRedis.expire).toHaveBeenNthCalledWith(2, `user_sessions:${userId}`, 604800);
        });
    });

    describe('getUserIdFromRefreshToken', () => {
        it('should return userId for valid token', async () => {
            mockRedis.get.mockResolvedValue(userId);

            const result = await sessionService.getUserIdFromRefreshToken(token);

            expect(mockRedis.get).toHaveBeenCalledWith(`refresh:${token}`);
            expect(result).toBe(userId);
        });

        it('should return null for expired or invalid token', async () => {
            mockRedis.get.mockResolvedValue(null);

            const result = await sessionService.getUserIdFromRefreshToken(token);

            expect(result).toBeNull();
        });
    });

    describe('removeRefreshToken', () => {
        it('should delete token and remove from session set when userId exists', async () => {
            mockRedis.get.mockResolvedValue(userId);

            const result = await sessionService.removeRefreshToken(token);

            expect(mockRedis.get).toHaveBeenCalledWith(`refresh:${token}`);
            expect(mockRedis.del).toHaveBeenCalledWith(`refresh:${token}`);
            expect(mockRedis.srem).toHaveBeenCalledWith(`user_sessions:${userId}`, token);
            expect(result).toBe(userId);
        });

        it('should delete token but skip srem when userId is not found', async () => {
            mockRedis.get.mockResolvedValue(null);

            const result = await sessionService.removeRefreshToken(token);

            expect(mockRedis.del).toHaveBeenCalledWith(`refresh:${token}`);
            expect(mockRedis.srem).not.toHaveBeenCalled();
            expect(result).toBeNull();
        });
    });

    describe('invalidateAllSessions', () => {
        it('should delete all refresh tokens and the session set via pipeline', async () => {
            const tokens = ['token-1', 'token-2', 'token-3'];
            mockRedis.smembers.mockResolvedValue(tokens);

            const result = await sessionService.invalidateAllSessions(userId);

            expect(mockRedis.smembers).toHaveBeenCalledWith(`user_sessions:${userId}`);
            expect(mockRedis.pipeline).toHaveBeenCalled();
            expect(mockPipeline.del).toHaveBeenCalledTimes(4); // 3 tokens + 1 session set
            expect(mockPipeline.del).toHaveBeenCalledWith('refresh:token-1');
            expect(mockPipeline.del).toHaveBeenCalledWith('refresh:token-2');
            expect(mockPipeline.del).toHaveBeenCalledWith('refresh:token-3');
            expect(mockPipeline.del).toHaveBeenCalledWith(`user_sessions:${userId}`);
            expect(mockPipeline.exec).toHaveBeenCalled();
            expect(result).toBe(3);
        });

        it('should return 0 and skip pipeline when user has no sessions', async () => {
            mockRedis.smembers.mockResolvedValue([]);

            const result = await sessionService.invalidateAllSessions(userId);

            expect(mockRedis.smembers).toHaveBeenCalledWith(`user_sessions:${userId}`);
            expect(mockRedis.pipeline).not.toHaveBeenCalled();
            expect(result).toBe(0);
        });

        it('should handle single session correctly', async () => {
            mockRedis.smembers.mockResolvedValue(['only-token']);

            const result = await sessionService.invalidateAllSessions(userId);

            expect(mockPipeline.del).toHaveBeenCalledTimes(2); // 1 token + 1 session set
            expect(result).toBe(1);
        });
    });
});
