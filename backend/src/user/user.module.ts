import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { SessionModule } from '../session/session.module';

@Module({
    imports: [PrismaModule, SessionModule],
    controllers: [UserController],
    providers: [UserService],
})
export class UserModule {}
