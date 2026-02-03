import { Module } from '@nestjs/common';
import { SharedExpenseService } from './shared-expense.service';
import { SharedExpenseController } from './shared-expense.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ExpenseHelperModule } from '../common/expense/expense-helper.module';

@Module({
    imports: [PrismaModule, ExpenseHelperModule],
    controllers: [SharedExpenseController],
    providers: [SharedExpenseService],
})
export class SharedExpenseModule {}
