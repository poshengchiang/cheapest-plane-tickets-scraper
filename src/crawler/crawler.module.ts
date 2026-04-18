import { Module } from '@nestjs/common'

import { AlternativeRouteModule } from '../modules/alternative-route/alternative-route.module.js';
import { DirectRouteModule } from '../modules/direct-route/direct-route.module.js';
import { ServicesModule } from '../services/services.module.js';
import { CrawlerService } from './crawler.service.js';
import { CrawlerHooksService } from './crawler-hooks.service.js';

@Module({
    imports: [ServicesModule, DirectRouteModule, AlternativeRouteModule],
    providers: [CrawlerService, CrawlerHooksService],
    exports: [CrawlerService],
})
export class CrawlerModule {}
