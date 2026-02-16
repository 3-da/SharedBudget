import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardCalculatorService } from './dashboard-calculator.service';
import { DashboardController } from './dashboard.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ExpenseHelperModule } from '../common/expense/expense-helper.module';

@Module({
    imports: [PrismaModule, ExpenseHelperModule],
    controllers: [DashboardController],
    providers: [DashboardService, DashboardCalculatorService],
})
export class DashboardModule {}
