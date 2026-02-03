import { Module } from '@nestjs/common';
import { PersonalExpenseService } from './personal-expense.service';
import { PersonalExpenseController } from './personal-expense.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ExpenseHelperModule } from '../common/expense/expense-helper.module';

@Module({
    imports: [PrismaModule, ExpenseHelperModule],
    controllers: [PersonalExpenseController],
    providers: [PersonalExpenseService],
})
export class PersonalExpenseModule {}
