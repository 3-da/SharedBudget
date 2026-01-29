import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { REDIS_CLIENT, RedisModule } from './redis/redis.module';
import { ThrottlerRedisStorage } from './redis/throttler-redis.storage';
import { MailModule } from './mail/mail.module';
import Redis from 'ioredis';
import { LoggerModule } from 'nestjs-pino';

@Module({
    imports: [
        LoggerModule,
        ConfigModule.forRoot(),
        RedisModule,
        MailModule,
        ThrottlerModule.forRootAsync({
            imports: [RedisModule],
            inject: [REDIS_CLIENT],
            useFactory: (redis: Redis) => ({
                throttlers: [{ ttl: 60000, limit: 10 }],
                storage: new ThrottlerRedisStorage(redis),
            }),
        }),
        PrismaModule,
        AuthModule,
    ],
    controllers: [AppController],
    providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
