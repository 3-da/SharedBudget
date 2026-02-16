import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheService } from './cache.service';

/**
 * Global cache module providing CacheService to the entire application.
 *
 * `@Global()` is intentional: CacheService is used by nearly every service
 * (dashboard, salary, expense, approval, savings, settlement) for Redis-backed
 * caching. Without `@Global()`, every feature module would need to import
 * CacheModule explicitly, adding boilerplate with no architectural benefit.
 *
 * By marking this module global, any service can inject CacheService directly
 * without importing CacheModule in its own module's `imports` array.
 */

/**
 * `@Global()` is intentional — CacheService is used by nearly every feature module
 * (expenses, dashboard, salary, savings, approvals). Making it global avoids redundant
 * imports in every module and ensures a single shared instance across the application.
 */

@Global()
@Module({
    imports: [ConfigModule],
    providers: [CacheService],
    exports: [CacheService],
})
export class CacheModule {}
