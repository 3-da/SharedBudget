import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DemoSeedService } from './demo-seed.service';
import { DemoSeedScheduler } from './demo-seed.scheduler';

@Module({
    imports: [ScheduleModule.forRoot()],
    providers: [DemoSeedService, DemoSeedScheduler],
})
export class DemoDataModule {}
