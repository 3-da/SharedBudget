import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

const logger = new Logger('RedisModule');

/**
 * Global Redis module providing the ioredis client to the entire application.
 *
 * `@Global()` is intentional: the REDIS_CLIENT token is injected by CacheService
 * (caching), SessionService (refresh tokens, verification codes), and
 * ThrottlerRedisStorage (rate limiting). These consumers span multiple modules.
 * Without `@Global()`, every module needing Redis access would have to import
 * RedisModule explicitly, duplicating boilerplate across the module tree.
 *
 * A single Redis connection is shared application-wide via the REDIS_CLIENT
 * injection token. Key prefixes (cache:, refresh:, verify:, reset:) prevent
 * namespace collisions between the three concerns.
 */

/**
 * `@Global()` is intentional — the REDIS_CLIENT token is injected directly by CacheModule,
 * SessionService, AuthService, and ThrottlerRedisStorage. Making it global avoids importing
 * RedisModule in every feature module and ensures a single Redis connection pool.
 */

@Global()
@Module({
    imports: [ConfigModule],
    providers: [
        {
            provide: REDIS_CLIENT,
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
                const client = new Redis({
                    host: configService.get('REDIS_HOST'),
                    port: configService.get<number>('REDIS_PORT'),
                    password: configService.get('REDIS_PASSWORD'),
                    ...(configService.get('NODE_ENV') === 'production' ? { tls: {} } : {}),
                    maxRetriesPerRequest: 3,
                    enableOfflineQueue: true,
                    retryStrategy(times) {
                        if (times > 10) return null; // Stop retrying after 10 attempts
                        return Math.min(times * 200, 2000); // Exponential backoff, max 2s
                    },
                    reconnectOnError(err) {
                        const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
                        return targetErrors.some((e) => err.message.includes(e));
                    },
                });

                client.on('error', (err) => logger.error(`Redis error: ${err.message}`));
                client.on('reconnecting', (delay: number) => logger.warn(`Redis reconnecting in ${delay}ms`));

                return client;
            },
        },
    ],
    exports: [REDIS_CLIENT],
})
export class RedisModule {}
