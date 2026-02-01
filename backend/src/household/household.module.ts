import { Module } from '@nestjs/common';
import { HouseholdService } from './household.service';
import { HouseholdInvitationService } from './household-invitation.service';
import { HouseholdController } from './household.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [HouseholdController],
    providers: [HouseholdService, HouseholdInvitationService],
})
export class HouseholdModule {}
