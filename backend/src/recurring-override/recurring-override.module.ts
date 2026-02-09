import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ExpenseHelperModule } from '../common/expense/expense-helper.module';
import { CacheModule } from '../common/cache/cache.module';
import { RecurringOverrideController } from './recurring-override.controller';
import { RecurringOverrideService } from './recurring-override.service';

@Module({
    imports: [PrismaModule, ExpenseHelperModule, CacheModule],
    controllers: [RecurringOverrideController],
    providers: [RecurringOverrideService],
    exports: [RecurringOverrideService],
})
export class RecurringOverrideModule {}
