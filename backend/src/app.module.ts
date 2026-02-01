import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { REDIS_CLIENT, RedisModule } from './redis/redis.module';
import { ThrottlerRedisStorage } from './redis/throttler-redis.storage';
import { MailModule } from './mail/mail.module';
import Redis from 'ioredis';
import { LoggerModule } from './common/logger/logger.module';
import { HouseholdModule } from './household/household.module';
import { SalaryModule } from './salary/salary.module';

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
        HouseholdModule,
        SalaryModule,
    ],
    controllers: [AppController],
    providers: [
        AppService,
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_FILTER, useClass: HttpExceptionFilter },
    ],
})
export class AppModule {}
