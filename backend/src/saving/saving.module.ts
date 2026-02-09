import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ExpenseHelperModule } from '../common/expense/expense-helper.module';
import { CacheModule } from '../common/cache/cache.module';
import { SavingController } from './saving.controller';
import { SavingService } from './saving.service';

@Module({
    imports: [PrismaModule, ExpenseHelperModule, CacheModule],
    controllers: [SavingController],
    providers: [SavingService],
    exports: [SavingService],
})
export class SavingModule {}
