import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { json } from 'express';
import basicAuth from 'express-basic-auth';
import cookieParser from 'cookie-parser';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, { bufferLogs: true });
    app.useLogger(app.get(Logger));
    const configService = app.get(ConfigService);

    // Security headers
    app.use(helmet());

    // Cookie parsing
    app.use(cookieParser());

    // Body size limit
    app.use(json({ limit: '100kb' }));

    // Global validation pipe
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

    // API prefix
    const apiPrefix = configService.get('API_PREFIX', 'api/v1');
    app.setGlobalPrefix(apiPrefix);

    // CORS — parse comma-separated origins, validate each
    const corsOriginRaw = configService.get('CORS_ORIGIN', 'http://localhost:4200');
    const corsOrigins = corsOriginRaw.split(',').map((o: string) => o.trim()).filter(Boolean);
    app.enableCors({
        origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
            // Allow requests with no origin (server-to-server, curl, mobile)
            if (!origin || corsOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error(`Origin ${origin} not allowed by CORS`));
            }
        },
        credentials: true,
    });

    // Swagger setup (disabled in production, basic auth in staging)
    if (configService.get('NODE_ENV') !== 'production') {
        const swaggerUser = configService.get<string>('SWAGGER_USER');
        const swaggerPassword = configService.get<string>('SWAGGER_PASSWORD');

        if (swaggerUser && swaggerPassword) {
            app.use('/docs', basicAuth({ users: { [swaggerUser]: swaggerPassword }, challenge: true }));
        }

        const config = new DocumentBuilder()
            .setTitle('SharedBudget API')
            .setDescription('API for SharedBudget household expense management')
            .setVersion('1.0')
            .addBearerAuth()
            .build();
        const document = SwaggerModule.createDocument(app, config);
        SwaggerModule.setup('docs', app, document);
    }

    const port = configService.get('PORT', 3000);
    await app.listen(port);

    // Graceful shutdown
    app.enableShutdownHooks();

    const logger = app.get(Logger);
    logger.log(`Application running on: http://localhost:${port}/${apiPrefix}`);
    if (configService.get('NODE_ENV') !== 'production') {
        logger.log(`Swagger docs: http://localhost:${port}/docs`);
    }
}

bootstrap();
