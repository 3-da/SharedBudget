import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import * as Joi from 'joi';
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
import { UserModule } from './user/user.module';
import { PersonalExpenseModule } from './personal-expense/personal-expense.module';
import { SharedExpenseModule } from './shared-expense/shared-expense.module';
import { ApprovalModule } from './approval/approval.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CacheModule } from './common/cache/cache.module';
import { ExpensePaymentModule } from './expense-payment/expense-payment.module';
import { RecurringOverrideModule } from './recurring-override/recurring-override.module';
import { SavingModule } from './saving/saving.module';

@Module({
    imports: [
        LoggerModule,
        ConfigModule.forRoot({
            isGlobal: true,
            validationSchema: Joi.object({
                NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
                PORT: Joi.number().default(3000),
                API_PREFIX: Joi.string().default('api/v1'),
                CORS_ORIGIN: Joi.string().default('http://localhost:4200'),
                DATABASE_URL: Joi.string().required(),
                REDIS_HOST: Joi.string().default('localhost'),
                REDIS_PORT: Joi.number().default(6379),
                REDIS_PASSWORD: Joi.string().allow('').default(''),
                JWT_ACCESS_SECRET: Joi.string().min(32).required(),
                JWT_ACCESS_EXPIRATION: Joi.string().required(),
                JWT_REFRESH_SECRET: Joi.string().min(32).required(),
                JWT_REFRESH_EXPIRATION: Joi.number().default(604800),
                FRONTEND_URL: Joi.string().uri().required(),
                MAIL_FROM: Joi.string().default('noreply@sharedbudget.app'),
                AUTH_VERIFICATION_CODE_TTL: Joi.number().default(600),
                AUTH_RESET_TOKEN_TTL: Joi.number().default(3600),
                ARGON2_MEMORY_COST: Joi.number().default(65536),
                ARGON2_TIME_COST: Joi.number().default(3),
                ARGON2_PARALLELISM: Joi.number().default(4),
                HOUSEHOLD_MAX_MEMBERS: Joi.number().default(10),
                INVITE_CODE_LENGTH: Joi.number().default(8),
                RESEND_API_KEY: Joi.string().allow('').default(''),
                SWAGGER_USER: Joi.string().optional(),
                SWAGGER_PASSWORD: Joi.string().optional(),
            }),
            validationOptions: { abortEarly: false, allowUnknown: true },
        }),
        RedisModule,
        CacheModule,
        MailModule,
        ThrottlerModule.forRootAsync({
            imports: [RedisModule],
            inject: [REDIS_CLIENT],
            useFactory: (redis: Redis) => ({
                throttlers: [{ ttl: 60000, limit: 100 }],
                storage: new ThrottlerRedisStorage(redis),
            }),
        }),
        PrismaModule,
        AuthModule,
        HouseholdModule,
        SalaryModule,
        UserModule,
        PersonalExpenseModule,
        SharedExpenseModule,
        ApprovalModule,
        DashboardModule,
        ExpensePaymentModule,
        RecurringOverrideModule,
        SavingModule,
    ],
    controllers: [AppController],
    providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }, { provide: APP_FILTER, useClass: HttpExceptionFilter }],
})
export class AppModule {}
