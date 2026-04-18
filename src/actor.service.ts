import { Injectable } from '@nestjs/common';

import { CrawlerService } from './crawler/crawler.service.js';
import { AlternativeRouteService } from './modules/alternative-route/alternative-route.service.js';
import { DirectRouteService } from './modules/direct-route/direct-route.service.js';
import { ResultsStoreService } from './services/results-store.service.js';
import type { Input, RouteResult } from './types.js';

@Injectable()
export class ActorService {
    private readonly routeServices: readonly [DirectRouteService, AlternativeRouteService];

    constructor(
        private readonly crawlerService: CrawlerService,
        private readonly directRouteService: DirectRouteService,
        private readonly alternativeRouteService: AlternativeRouteService,
        private readonly resultsStoreService: ResultsStoreService,
    ) {
        this.routeServices = [directRouteService, alternativeRouteService];
    }

    async run(input: Input): Promise<RouteResult[]> {
        if (input.maxFlightsPerSearch) {
            this.resultsStoreService.setMaxLimit(input.maxFlightsPerSearch);
        }

        const crawler = await this.crawlerService.createCrawler();

        const startUrls = this.routeServices.flatMap((service) =>
            service.createSearchInfos(input, input.timePeriods).map((searchInfo) =>
                this.crawlerService.createPipelineRequest({
                    pipelineName: service.pipelineName,
                    stepIndex: 0,
                    searchInfo,
                }),
            ),
        );

        await crawler.run(startUrls);
        return this.resultsStoreService.getAllSorted();
    }
}
