import { Module } from '@nestjs/common';
import { ApprovalController } from './approval.controller';
import { ApprovalService } from './approval.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ExpenseHelperModule } from '../common/expense/expense-helper.module';
import { SavingModule } from '../saving/saving.module';

@Module({
    imports: [PrismaModule, ExpenseHelperModule, SavingModule],
    controllers: [ApprovalController],
    providers: [ApprovalService],
})
export class ApprovalModule {}
