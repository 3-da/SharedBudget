import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException, HttpStatus, Logger, NotFoundException } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { HttpExceptionFilter } from './http-exception.filter';
import { PrismaClientKnownRequestError } from '../../generated/prisma/internal/prismaNamespace.js';

describe('HttpExceptionFilter', () => {
    let filter: HttpExceptionFilter;
    let mockReply: ReturnType<typeof vi.fn>;
    let mockHost: any;
    let mockRequest: { id: string };

    beforeEach(() => {
        mockReply = vi.fn();
        mockRequest = { id: 'req-123-abc' };

        const mockHttpAdapterHost: HttpAdapterHost = {
            httpAdapter: { reply: mockReply } as any,
        } as HttpAdapterHost;

        mockHost = {
            switchToHttp: () => ({
                getRequest: () => mockRequest,
                getResponse: () => ({}),
            }),
        };

        filter = new HttpExceptionFilter(mockHttpAdapterHost);

        // Suppress logger output during tests
        vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    });

    describe('HttpException handling', () => {
        it('should return correct shape for a ConflictException', () => {
            const exception = new ConflictException('User already belongs to a household');

            filter.catch(exception, mockHost);

            expect(mockReply).toHaveBeenCalledWith(
                {},
                expect.objectContaining({
                    statusCode: HttpStatus.CONFLICT,
                    message: 'User already belongs to a household',
                    error: 'Conflict',
                }),
                HttpStatus.CONFLICT,
            );
        });

        it('should return correct shape for a NotFoundException', () => {
            const exception = new NotFoundException('Household not found');

            filter.catch(exception, mockHost);

            expect(mockReply).toHaveBeenCalledWith(
                {},
                expect.objectContaining({
                    statusCode: HttpStatus.NOT_FOUND,
                    message: 'Household not found',
                    error: 'Not Found',
                }),
                HttpStatus.NOT_FOUND,
            );
        });

        it('should handle HttpException with a plain string response', () => {
            const exception = new BadRequestException('Something went wrong');

            // Override getResponse to return a string
            vi.spyOn(exception, 'getResponse').mockReturnValue('Something went wrong');

            filter.catch(exception, mockHost);

            expect(mockReply).toHaveBeenCalledWith(
                {},
                expect.objectContaining({
                    statusCode: HttpStatus.BAD_REQUEST,
                    message: 'Something went wrong',
                }),
                HttpStatus.BAD_REQUEST,
            );
        });
    });

    describe('ValidationPipe error handling', () => {
        it('should preserve string[] message from ValidationPipe', () => {
            const exception = new BadRequestException({
                message: ['email must be an email', 'name should not be empty'],
                error: 'Bad Request',
                statusCode: 400,
            });

            filter.catch(exception, mockHost);

            expect(mockReply).toHaveBeenCalledWith(
                {},
                expect.objectContaining({
                    statusCode: HttpStatus.BAD_REQUEST,
                    message: ['email must be an email', 'name should not be empty'],
                    error: 'Bad Request',
                }),
                HttpStatus.BAD_REQUEST,
            );
        });
    });

    describe('Prisma error handling', () => {
        it('should map P2002 (unique constraint) to 409 Conflict', () => {
            const exception = new PrismaClientKnownRequestError('Unique constraint failed', {
                code: 'P2002',
                clientVersion: '7.3.0',
            });

            filter.catch(exception, mockHost);

            expect(mockReply).toHaveBeenCalledWith(
                {},
                expect.objectContaining({
                    statusCode: HttpStatus.CONFLICT,
                    message: 'A record with this value already exists',
                    error: 'Conflict',
                }),
                HttpStatus.CONFLICT,
            );
        });

        it('should map P2025 (record not found) to 404 Not Found', () => {
            const exception = new PrismaClientKnownRequestError('Record to update not found', {
                code: 'P2025',
                clientVersion: '7.3.0',
            });

            filter.catch(exception, mockHost);

            expect(mockReply).toHaveBeenCalledWith(
                {},
                expect.objectContaining({
                    statusCode: HttpStatus.NOT_FOUND,
                    message: 'Record not found',
                    error: 'Not Found',
                }),
                HttpStatus.NOT_FOUND,
            );
        });

        it('should map unknown Prisma error codes to 500 and log', () => {
            const loggerSpy = vi.spyOn(Logger.prototype, 'error');

            const exception = new PrismaClientKnownRequestError('Foreign key constraint failed', {
                code: 'P2003',
                clientVersion: '7.3.0',
            });

            filter.catch(exception, mockHost);

            expect(mockReply).toHaveBeenCalledWith(
                {},
                expect.objectContaining({
                    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
                    message: 'Internal server error',
                    error: 'Internal Server Error',
                }),
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
            expect(loggerSpy).toHaveBeenCalled();
        });
    });

    describe('Unknown error handling', () => {
        it('should return 500 with generic message for unknown errors', () => {
            const exception = new Error('Something completely unexpected');

            filter.catch(exception, mockHost);

            expect(mockReply).toHaveBeenCalledWith(
                {},
                expect.objectContaining({
                    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
                    message: 'Internal server error',
                    error: 'Internal Server Error',
                }),
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        });

        it('should log unknown errors at error level', () => {
            const loggerSpy = vi.spyOn(Logger.prototype, 'error');
            const exception = new Error('Database connection lost');

            filter.catch(exception, mockHost);

            expect(loggerSpy).toHaveBeenCalledWith(
                'Unexpected error: Database connection lost',
                expect.any(String),
            );
        });

        it('should handle non-Error thrown values gracefully', () => {
            filter.catch('a string was thrown', mockHost);

            expect(mockReply).toHaveBeenCalledWith(
                {},
                expect.objectContaining({
                    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
                    message: 'Internal server error',
                }),
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        });
    });

    describe('response metadata', () => {
        it('should include requestId from the request', () => {
            const exception = new NotFoundException('Not found');

            filter.catch(exception, mockHost);

            expect(mockReply).toHaveBeenCalledWith(
                {},
                expect.objectContaining({ requestId: 'req-123-abc' }),
                expect.any(Number),
            );
        });

        it('should fall back to "unknown" when request has no id', () => {
            mockRequest.id = undefined as any;
            const exception = new NotFoundException('Not found');

            filter.catch(exception, mockHost);

            expect(mockReply).toHaveBeenCalledWith(
                {},
                expect.objectContaining({ requestId: 'unknown' }),
                expect.any(Number),
            );
        });

        it('should include a valid ISO 8601 timestamp', () => {
            const exception = new NotFoundException('Not found');

            filter.catch(exception, mockHost);

            const responseBody = mockReply.mock.calls[0][1];
            expect(responseBody.timestamp).toBeDefined();
            expect(new Date(responseBody.timestamp).toISOString()).toBe(responseBody.timestamp);
        });
    });
});
