import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, { bufferLogs: true });
    app.useLogger(app.get(Logger));
    const configService = app.get(ConfigService);

    // Global validation pipe
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    // API prefix
    const apiPrefix = configService.get('API_PREFIX', 'api/v1');
    app.setGlobalPrefix(apiPrefix);

    // CORS
    const corsOrigin = configService.get('CORS_ORIGIN', 'http://localhost:5173');
    app.enableCors({ origin: corsOrigin, credentials: true });

    // Swagger setup
    if (configService.get('NODE_ENV') !== 'production') {
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

    const logger = app.get(Logger);
    logger.log(`Application running on: http://localhost:${port}/${apiPrefix}`);
    logger.log(`Swagger docs: http://localhost:${port}/docs`);
}

bootstrap();
