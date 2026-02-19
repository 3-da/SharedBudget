import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);

    constructor() {
        const adapter = new PrismaPg({
            connectionString: process.env.DATABASE_URL as string,
        });
        super({ adapter });
    }

    async onModuleInit(): Promise<void> {
        await this.$connect();
        this.applySoftDeleteExtension();
        this.logger.log('Soft-delete extension applied for models: expense');
    }

    async onModuleDestroy(): Promise<void> {
        await this.$disconnect();
    }

    /**
     * Applies a Prisma client extension that automatically adds `deletedAt: null`
     * to `findMany` and `findFirst` queries on soft-deletable models (expense).
     *
     * This eliminates the need to manually add `deletedAt: null` in every query.
     * Note: `findUnique` is excluded because Prisma does not support adding
     * where clauses via `$extends` for unique lookups.
     *
     * Nested relation filters (e.g., `expensePaymentStatus.findMany({ where: { expense: { deletedAt: null } } })`)
     * are NOT affected by this extension and must still include `deletedAt: null` manually.
     */
    private applySoftDeleteExtension(): void {
        const softDeleteFilter = {
            async findMany({ args, query }: { args: any; query: any }) {
                args.where = { ...args.where, deletedAt: null };
                return query(args);
            },
            async findFirst({ args, query }: { args: any; query: any }) {
                args.where = { ...args.where, deletedAt: null };
                return query(args);
            },
        };

        Object.assign(
            this,
            this.$extends({
                query: {
                    expense: softDeleteFilter,
                },
            }),
        );
    }
}
