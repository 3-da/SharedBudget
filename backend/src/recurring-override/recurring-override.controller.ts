import { Controller, UseGuards, Param, Body, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RecurringOverrideService } from './recurring-override.service';
import { UpsertOverrideDto } from './dto/upsert-override.dto';
import { UpdateDefaultAmountDto } from './dto/update-default-amount.dto';
import { BatchUpsertOverrideDto } from './dto/batch-upsert-override.dto';
import { RecurringOverrideResponseDto } from './dto/recurring-override-response.dto';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import {
    UpsertOverrideEndpoint,
    UpdateDefaultAmountEndpoint,
    ListOverridesEndpoint,
    DeleteOverrideEndpoint,
    DeleteAllOverridesEndpoint,
    BatchUpsertOverridesEndpoint,
    DeleteUpcomingOverridesEndpoint,
} from './decorators/api-recurring-override.decorators';

@ApiTags('Recurring Overrides')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class RecurringOverrideController {
    constructor(private readonly recurringOverrideService: RecurringOverrideService) {}

    @UpsertOverrideEndpoint()
    async upsertOverride(
        @CurrentUser('id') userId: string,
        @Param('id') expenseId: string,
        @Param('year', ParseIntPipe) year: number,
        @Param('month', ParseIntPipe) month: number,
        @Body() dto: UpsertOverrideDto,
    ): Promise<RecurringOverrideResponseDto> {
        return this.recurringOverrideService.upsertOverride(userId, expenseId, year, month, dto);
    }

    @UpdateDefaultAmountEndpoint()
    async updateDefaultAmount(
        @CurrentUser('id') userId: string,
        @Param('id') expenseId: string,
        @Body() dto: UpdateDefaultAmountDto,
    ): Promise<MessageResponseDto> {
        return this.recurringOverrideService.updateDefaultAmount(userId, expenseId, dto);
    }

    @DeleteOverrideEndpoint()
    async deleteOverride(
        @CurrentUser('id') userId: string,
        @Param('id') expenseId: string,
        @Param('year', ParseIntPipe) year: number,
        @Param('month', ParseIntPipe) month: number,
    ): Promise<MessageResponseDto> {
        return this.recurringOverrideService.deleteOverride(userId, expenseId, year, month);
    }

    @DeleteAllOverridesEndpoint()
    async deleteAllOverrides(@CurrentUser('id') userId: string, @Param('id') expenseId: string): Promise<MessageResponseDto> {
        return this.recurringOverrideService.deleteAllOverrides(userId, expenseId);
    }

    @BatchUpsertOverridesEndpoint()
    async batchUpsertOverrides(
        @CurrentUser('id') userId: string,
        @Param('id') expenseId: string,
        @Body() dto: BatchUpsertOverrideDto,
    ): Promise<RecurringOverrideResponseDto[]> {
        return this.recurringOverrideService.batchUpsertOverrides(userId, expenseId, dto.overrides);
    }

    @DeleteUpcomingOverridesEndpoint()
    async deleteUpcomingOverrides(
        @CurrentUser('id') userId: string,
        @Param('id') expenseId: string,
        @Param('year', ParseIntPipe) year: number,
        @Param('month', ParseIntPipe) month: number,
    ): Promise<MessageResponseDto> {
        return this.recurringOverrideService.deleteUpcomingOverrides(userId, expenseId, year, month);
    }

    @ListOverridesEndpoint()
    async listOverrides(@CurrentUser('id') userId: string, @Param('id') expenseId: string): Promise<RecurringOverrideResponseDto[]> {
        return this.recurringOverrideService.listOverrides(userId, expenseId);
    }
}
