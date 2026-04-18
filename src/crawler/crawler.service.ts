import { Injectable } from '@nestjs/common';
import { Actor, log } from 'apify';
import type { PlaywrightCrawlingContext } from 'crawlee';
import { createPlaywrightRouter, PlaywrightCrawler } from 'crawlee';

import { createInboundUrl, createOutBoundUrl } from '../common/utils/url-utils.js';
import { LABELS } from '../constants.js';
import { AlternativeRouteService } from '../modules/alternative-route/alternative-route.service.js';
import { DirectRouteService } from '../modules/direct-route/direct-route.service.js';
import { ResultsStoreService } from '../services/results-store.service.js';
import type {
    FlightInfo,
    InboundPipelineUserData,
    OutboundPipelineUserData,
    PipelineName,
    PipelineStep,
    PipelineUserData,
} from '../types.js';
import { CrawlerHooksService } from './crawler-hooks.service.js';

@Injectable()
export class CrawlerService {
    private readonly pipelines: Record<PipelineName, PipelineStep[]>;

    constructor(
        private readonly directRouteService: DirectRouteService,
        private readonly alternativeRouteService: AlternativeRouteService,
        private readonly resultsStoreService: ResultsStoreService,
        private readonly crawlerHooksService: CrawlerHooksService,
    ) {
        this.pipelines = {
            [directRouteService.pipelineName]: directRouteService.pipeline,
            [alternativeRouteService.pipelineName]: alternativeRouteService.pipeline,
        };
    }

    createPipelineRequest(userData: PipelineUserData) {
        const step = this.pipelines[userData.pipelineName][userData.stepIndex];
        const cities = step.getCities(userData.searchInfo);
        const { searchInfo } = userData;

        if (step.handler === 'outbound') {
            return {
                url: createOutBoundUrl({
                    ...cities,
                    departureDate: searchInfo.departureDate,
                    returnDate: searchInfo.returnDate,
                    cabinClass: searchInfo.cabinClass,
                    quantity: searchInfo.quantity,
                    airlines: searchInfo.airlines,
                }),
                label: LABELS.SEARCH_OUTBOUND,
                userData,
            };
        }

        if (!('lastFlight' in userData)) throw new Error(`Step '${step.name}' requires InboundPipelineUserData`);
        return {
            url: createInboundUrl({
                ...cities,
                departureDate: searchInfo.departureDate,
                returnDate: searchInfo.returnDate,
                productId: userData.lastFlight.productId,
                policyId: userData.lastFlight.policyId,
                cabinClass: searchInfo.cabinClass,
                quantity: searchInfo.quantity,
                airlines: searchInfo.airlines,
            }),
            label: LABELS.SEARCH_INBOUND,
            userData,
        };
    }

    async createCrawler() {
        const proxyConfiguration = await Actor.createProxyConfiguration({ groups: ['RESIDENTIAL'] });
        const router = this.createRouter();

        return new PlaywrightCrawler({
            proxyConfiguration,
            maxConcurrency: 3,
            headless: true,
            requestHandler: async (context) => {
                if (this.resultsStoreService.isReachLimit()) {
                    log.info('Flight limit reached, skipping request', { label: context.request.label });
                    context.request.noRetry = true;
                    return;
                }
                await router(context);
            },
            navigationTimeoutSecs: 60,
            preNavigationHooks: [
                this.crawlerHooksService.sseHook,
                this.crawlerHooksService.responseHook,
            ],
            launchContext: {
                launchOptions: { args: ['--disable-gpu'] },
            },
        });
    }

    private createRouter() {
        const router = createPlaywrightRouter();

        router.addHandler<OutboundPipelineUserData>(LABELS.SEARCH_OUTBOUND, async ({ request, crawler }) => {
            const { pipelineName, stepIndex, searchInfo, combinedFlight } = request.userData;
            const step = this.pipelines[pipelineName][stepIndex];

            const flights = await this.getAndValidateFlightData(request, 'sseResponsePromise');

            const nextRequests = flights.slice(0, step.fanOut).map((flight) =>
                this.createPipelineRequest({
                    pipelineName,
                    stepIndex: stepIndex + 1,
                    searchInfo,
                    lastFlight: flight,
                    combinedFlight,
                }),
            );

            await crawler.addRequests(nextRequests);
        });

        router.addHandler<InboundPipelineUserData>(LABELS.SEARCH_INBOUND, async ({ request, crawler }) => {
            const { pipelineName, stepIndex, searchInfo, lastFlight, combinedFlight } = request.userData;
            const step = this.pipelines[pipelineName][stepIndex];

            if (step.handler !== 'inbound') {
                throw new Error(`Unexpected outbound step '${step.name}' in SEARCH_INBOUND handler`);
            }

            const flights = await this.getAndValidateFlightData(request, 'flightResponsePromise');

            for (const flight of flights.slice(0, step.fanOut)) {
                const result = step.execute({ flight, lastFlight, combinedFlight, searchInfo });

                if (result.type === 'advance') {
                    await crawler.addRequests([
                        this.createPipelineRequest({
                            pipelineName,
                            stepIndex: stepIndex + 1,
                            searchInfo,
                            combinedFlight: result.combinedFlight,
                        }),
                    ]);
                } else {
                    await this.resultsStoreService.append(result.results);
                }
            }
        });

        return router;
    }

    private async getAndValidateFlightData(
        request: PlaywrightCrawlingContext['request'],
        promiseKey: 'sseResponsePromise' | 'flightResponsePromise',
    ): Promise<FlightInfo[]> {
        const flightData = await request.userData[promiseKey];

        if (!flightData) {
            log.error(`${promiseKey} returned no data`);
            throw new Error(`Missing flight data from ${promiseKey}`);
        }

        return flightData;
    }
}
