import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from '../src/app.module.js';
import { writeFileSync } from 'fs';

async function generate() {
    const app = await NestFactory.create(AppModule, { logger: false });

    const config = new DocumentBuilder()
        .setTitle('SharedBudget API')
        .setDescription('Household budget management API')
        .setVersion('1.0')
        .addBearerAuth()
        .build();

    const document = SwaggerModule.createDocument(app, config);
    writeFileSync('./openapi.json', JSON.stringify(document, null, 2));

    console.log('OpenAPI spec written to openapi.json');
    await app.close();
}

generate();
