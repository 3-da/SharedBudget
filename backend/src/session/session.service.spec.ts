import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SessionService } from './session.service';
import { REDIS_CLIENT } from '../redis/redis.module';

describe('SessionService', () => {
    let sessionService: SessionService;

    const userId = 'user-123';
    const token = 'refresh-token-abc';
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

    const mockPipeline = {
        set: vi.fn().mockReturnThis(),
        sadd: vi.fn().mockReturnThis(),
        srem: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        del: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
    };

    const mockRedis = {
        get: vi.fn(),
        smembers: vi.fn().mockResolvedValue([]),
        pipeline: vi.fn(() => mockPipeline),
    };

    const mockConfigService = {
        get: vi.fn().mockReturnValue(604800),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [SessionService, { provide: REDIS_CLIENT, useValue: mockRedis }, { provide: ConfigService, useValue: mockConfigService }],
        }).compile();

        sessionService = module.get<SessionService>(SessionService);

        vi.clearAllMocks();
    });

    describe('storeRefreshToken', () => {
        it('should store token as JSON with uaHash when userAgent provided', async () => {
            await sessionService.storeRefreshToken(userId, token, userAgent);

            expect(mockRedis.pipeline).toHaveBeenCalled();
            const storedValue = mockPipeline.set.mock.calls[0][1];
            const parsed = JSON.parse(storedValue);
            expect(parsed.userId).toBe(userId);
            expect(parsed.uaHash).toHaveLength(16);
            expect(mockPipeline.sadd).toHaveBeenCalledWith(`user_sessions:${userId}`, token);
            expect(mockPipeline.expire).toHaveBeenCalledWith(`user_sessions:${userId}`, 604800);
            expect(mockPipeline.exec).toHaveBeenCalled();
        });

        it('should store token as JSON with null uaHash when no userAgent', async () => {
            await sessionService.storeRefreshToken(userId, token);

            const storedValue = mockPipeline.set.mock.calls[0][1];
            const parsed = JSON.parse(storedValue);
            expect(parsed.userId).toBe(userId);
            expect(parsed.uaHash).toBeNull();
        });

        it('should refresh session set TTL on every new token', async () => {
            await sessionService.storeRefreshToken(userId, 'token-1');
            await sessionService.storeRefreshToken(userId, 'token-2');

            expect(mockPipeline.expire).toHaveBeenCalledTimes(2);
            expect(mockPipeline.expire).toHaveBeenNthCalledWith(1, `user_sessions:${userId}`, 604800);
            expect(mockPipeline.expire).toHaveBeenNthCalledWith(2, `user_sessions:${userId}`, 604800);
        });
    });

    describe('getSessionFromRefreshToken', () => {
        it('should parse JSON format and return session with uaHash', async () => {
            mockRedis.get.mockResolvedValue(JSON.stringify({ userId, uaHash: 'abc123def4567890' }));

            const result = await sessionService.getSessionFromRefreshToken(token);

            expect(mockRedis.get).toHaveBeenCalledWith(`refresh:${token}`);
            expect(result).toEqual({ userId, uaHash: 'abc123def4567890' });
        });

        it('should handle old plain-string format (graceful migration)', async () => {
            mockRedis.get.mockResolvedValue(userId);

            const result = await sessionService.getSessionFromRefreshToken(token);

            expect(result).toEqual({ userId, uaHash: null });
        });

        it('should return null for expired or invalid token', async () => {
            mockRedis.get.mockResolvedValue(null);

            const result = await sessionService.getSessionFromRefreshToken(token);

            expect(result).toBeNull();
        });
    });

    describe('getUserIdFromRefreshToken', () => {
        it('should return userId for JSON format token', async () => {
            mockRedis.get.mockResolvedValue(JSON.stringify({ userId, uaHash: 'abc' }));

            const result = await sessionService.getUserIdFromRefreshToken(token);

            expect(result).toBe(userId);
        });

        it('should return userId for old plain-string format', async () => {
            mockRedis.get.mockResolvedValue(userId);

            const result = await sessionService.getUserIdFromRefreshToken(token);

            expect(result).toBe(userId);
        });

        it('should return null for expired or invalid token', async () => {
            mockRedis.get.mockResolvedValue(null);

            const result = await sessionService.getUserIdFromRefreshToken(token);

            expect(result).toBeNull();
        });
    });

    describe('removeRefreshToken', () => {
        it('should delete token and remove from session set when session exists', async () => {
            mockRedis.get.mockResolvedValue(JSON.stringify({ userId, uaHash: 'abc' }));

            const result = await sessionService.removeRefreshToken(token);

            expect(mockRedis.pipeline).toHaveBeenCalled();
            expect(mockPipeline.del).toHaveBeenCalledWith(`refresh:${token}`);
            expect(mockPipeline.srem).toHaveBeenCalledWith(`user_sessions:${userId}`, token);
            expect(mockPipeline.exec).toHaveBeenCalled();
            expect(result).toBe(userId);
        });

        it('should delete token but skip srem when session is not found', async () => {
            mockRedis.get.mockResolvedValue(null);

            const result = await sessionService.removeRefreshToken(token);

            expect(mockPipeline.del).toHaveBeenCalledWith(`refresh:${token}`);
            expect(mockPipeline.srem).not.toHaveBeenCalled();
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

    describe('hashUserAgent', () => {
        it('should return a 16-character hex string', () => {
            const hash = sessionService.hashUserAgent(userAgent);

            expect(hash).toHaveLength(16);
            expect(hash).toMatch(/^[a-f0-9]{16}$/);
        });

        it('should return consistent hash for same input', () => {
            const hash1 = sessionService.hashUserAgent(userAgent);
            const hash2 = sessionService.hashUserAgent(userAgent);

            expect(hash1).toBe(hash2);
        });

        it('should return different hashes for different user agents', () => {
            const hash1 = sessionService.hashUserAgent('Chrome/120');
            const hash2 = sessionService.hashUserAgent('Firefox/115');

            expect(hash1).not.toBe(hash2);
        });
    });
});
