import { Module } from '@nestjs/common';

import { ActorService } from './actor.service.js';
import { CrawlerModule } from './crawler/crawler.module.js';
import { AlternativeRouteModule } from './modules/alternative-route/alternative-route.module.js';
import { DirectRouteModule } from './modules/direct-route/direct-route.module.js';
import { ServicesModule } from './services/services.module.js';

@Module({
    imports: [ServicesModule, DirectRouteModule, AlternativeRouteModule, CrawlerModule],
    providers: [ActorService],
})
export class AppModule {}
