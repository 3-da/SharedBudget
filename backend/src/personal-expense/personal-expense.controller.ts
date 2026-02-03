import { Body, Controller, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PersonalExpenseService } from './personal-expense.service';
import { CreatePersonalExpenseDto } from './dto/create-personal-expense.dto';
import { UpdatePersonalExpenseDto } from './dto/update-personal-expense.dto';
import { ListPersonalExpensesQueryDto } from './dto/list-personal-expenses-query.dto';
import { PersonalExpenseResponseDto } from './dto/personal-expense-response.dto';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import {
    CreatePersonalExpenseEndpoint,
    DeletePersonalExpenseEndpoint,
    GetPersonalExpenseEndpoint,
    ListPersonalExpensesEndpoint,
    UpdatePersonalExpenseEndpoint,
} from './decorators/api-personal-expense.decorators';

@ApiTags('Personal Expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('expenses/personal')
export class PersonalExpenseController {
    constructor(private readonly personalExpenseService: PersonalExpenseService) {}

    @ListPersonalExpensesEndpoint()
    async listPersonalExpenses(@CurrentUser('id') userId: string, @Query() query: ListPersonalExpensesQueryDto): Promise<PersonalExpenseResponseDto[]> {
        return this.personalExpenseService.listPersonalExpenses(userId, query);
    }

    @CreatePersonalExpenseEndpoint()
    async createPersonalExpense(@CurrentUser('id') userId: string, @Body() dto: CreatePersonalExpenseDto): Promise<PersonalExpenseResponseDto> {
        return this.personalExpenseService.createPersonalExpense(userId, dto);
    }

    @GetPersonalExpenseEndpoint()
    async getPersonalExpense(@CurrentUser('id') userId: string, @Param('id') expenseId: string): Promise<PersonalExpenseResponseDto> {
        return this.personalExpenseService.getPersonalExpense(userId, expenseId);
    }

    @UpdatePersonalExpenseEndpoint()
    async updatePersonalExpense(
        @CurrentUser('id') userId: string,
        @Param('id') expenseId: string,
        @Body() dto: UpdatePersonalExpenseDto,
    ): Promise<PersonalExpenseResponseDto> {
        return this.personalExpenseService.updatePersonalExpense(userId, expenseId, dto);
    }

    @DeletePersonalExpenseEndpoint()
    async deletePersonalExpense(@CurrentUser('id') userId: string, @Param('id') expenseId: string): Promise<MessageResponseDto> {
        return this.personalExpenseService.deletePersonalExpense(userId, expenseId);
    }
}
