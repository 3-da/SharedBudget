import { Module } from '@nestjs/common';
import { ExpenseHelperService } from './expense-helper.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    providers: [ExpenseHelperService],
    exports: [ExpenseHelperService],
})
export class ExpenseHelperModule {}
