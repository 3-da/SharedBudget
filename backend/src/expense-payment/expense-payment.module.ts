import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ExpenseHelperModule } from '../common/expense/expense-helper.module';
import { CacheModule } from '../common/cache/cache.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { ExpensePaymentController } from './expense-payment.controller';
import { ExpensePaymentService } from './expense-payment.service';

@Module({
    imports: [PrismaModule, ExpenseHelperModule, CacheModule, DashboardModule],
    controllers: [ExpensePaymentController],
    providers: [ExpensePaymentService],
    exports: [ExpensePaymentService],
})
export class ExpensePaymentModule {}
