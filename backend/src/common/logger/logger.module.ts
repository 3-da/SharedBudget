import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
    imports: [
        PinoLoggerModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
                const isProduction = configService.get('NODE_ENV') === 'production';

                return {
                    pinoHttp: {
                        level: isProduction ? 'info' : 'debug',
                        transport: isProduction ? undefined : { target: 'pino-pretty', options: { colorize: true, singleLine: true } },
                        autoLogging: true, // Auto-log request/response
                        redact: { paths: ['req.headers.authorization', 'req.body.password', 'req.body.newPassword', 'req.body.currentPassword', 'req.body.confirmPassword'], censor: '[REDACTED]' },

                        // Custom serializers
                        serializers: {
                            req: (req) => ({ method: req.method, url: req.url, userId: req.user?.sub }),
                            res: (res) => ({ statusCode: res.statusCode }),
                        },

                        genReqId: (req) => req.headers['x-request-id'] || crypto.randomUUID(), // Generate request IDs for tracing
                    },
                };
            },
        }),
    ],
})
export class LoggerModule {}
