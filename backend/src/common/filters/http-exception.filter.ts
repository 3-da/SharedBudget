import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { PrismaClientKnownRequestError } from '../../generated/prisma/internal/prismaNamespace.js';

interface HttpErrorResponse {
    statusCode: number;
    message: string[];
    error: string;
}

/**
 * Global exception filter that catches all errors and returns a consistent
 * response shape with statusCode, message, error, timestamp, and requestId.
 *
 * Handles three categories:
 * - HttpException — NestJS exceptions thrown by application code
 * - PrismaClientKnownRequestError — database constraint violations
 * - Unknown errors — everything else (logged, returned as 500)
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

    catch(exception: unknown, host: ArgumentsHost): void {
        const { httpAdapter } = this.httpAdapterHost;
        const ctx = host.switchToHttp();
        const request = ctx.getRequest();

        const requestId: string = request.id ?? 'unknown';
        const timestamp = new Date().toISOString();

        const { statusCode, message, error } = this.resolveException(exception);

        httpAdapter.reply(ctx.getResponse(), { statusCode, message, error, timestamp, requestId }, statusCode);
    }

    private resolveException(exception: unknown): HttpErrorResponse {
        if (exception instanceof HttpException) return this.handleHttpException(exception);
        if (exception instanceof PrismaClientKnownRequestError) return this.handlePrismaError(exception);

        return this.handleUnknownError(exception);
    }

    private normalizeMessage(message: unknown): string[] {
        if (Array.isArray(message)) return message.map(String);
        if (typeof message === 'string') return [message];
        return ['An error occurred'];
    }

    private handleHttpException(exception: HttpException): HttpErrorResponse {
        const statusCode = exception.getStatus();
        const response = exception.getResponse();

        // ValidationPipe returns { message: string[], error: string, statusCode: number }
        if (typeof response === 'object' && response !== null) {
            const res = response as Record<string, unknown>;
            return {
                statusCode,
                message: this.normalizeMessage(res.message ?? exception.message),
                error: (res.error as string) ?? HttpStatus[statusCode] ?? 'Error',
            };
        }

        return {
            statusCode,
            message: this.normalizeMessage(typeof response === 'string' ? response : exception.message),
            error: HttpStatus[statusCode] ?? 'Error',
        };
    }

    private handlePrismaError(exception: PrismaClientKnownRequestError): HttpErrorResponse {
        switch (exception.code) {
            case 'P2002':
                return {
                    statusCode: HttpStatus.CONFLICT,
                    message: ['A record with this value already exists'],
                    error: 'Conflict',
                };
            case 'P2025':
                return {
                    statusCode: HttpStatus.NOT_FOUND,
                    message: ['Record not found'],
                    error: 'Not Found',
                };
            default:
                this.logger.error(`Unhandled Prisma error [${exception.code}]: ${exception.message}`);
                return {
                    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
                    message: ['Internal server error'],
                    error: 'Internal Server Error',
                };
        }
    }

    private handleUnknownError(exception: unknown): HttpErrorResponse {
        const errorMessage = exception instanceof Error ? exception.message : 'Unknown error';
        this.logger.error(`Unexpected error: ${errorMessage}`, exception instanceof Error ? exception.stack : undefined);

        return {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: ['Internal server error'],
            error: 'Internal Server Error',
        };
    }
}
