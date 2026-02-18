import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaHealthIndicator } from './prisma.health';
import { RedisHealthIndicator } from './redis.health';

@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
    constructor(
        private readonly health: HealthCheckService,
        private readonly db: PrismaHealthIndicator,
        private readonly redis: RedisHealthIndicator,
    ) {}

    @Get()
    @HealthCheck()
    @ApiOperation({
        summary: 'Health check',
        description: 'Returns service health status including database and Redis connectivity. Used by the load balancer.',
    })
    check() {
        return this.health.check([() => this.db.isHealthy('database'), () => this.redis.isHealthy('redis')]);
    }
}
