import { Actor, Dataset, log } from 'apify';
import { PlaywrightCrawler } from 'crawlee';

import { captureResponseHook, captureSSEResponseHook } from './hooks.js';
import { AlternativeRouteModule } from './modules/alternative-route/index.js';
import { DirectRouteModule } from './modules/direct-route/index.js';
import { router } from './routes.js';
import { resultsStore } from './services/ResultsStore.js';
import type { Input } from './types.js';
import { createPipelineRequest } from './utils.js';

await Actor.init();

const input = (await Actor.getInput<Input>()) ?? ({} as Input);

if (!input.mainDepartureCity || !input.targetCity || !input.timePeriods || input.timePeriods.length === 0) {
    throw new Error('Missing required input: mainDepartureCity, targetCity, and timePeriods are required');
}

const { timePeriods, maxFlightsPerSearch } = input;

log.info('Actor input received:', {
    mainDepartureCity: input.mainDepartureCity,
    targetCity: input.targetCity,
    alternativeDepartureCities: input.alternativeDepartureCities,
    cabinClass: input.cabinClass,
    numberOfPeople: input.numberOfPeople,
    timePeriodsCount: timePeriods.length,
    airlinesFilter: input.airlines && input.airlines.length > 0 ? input.airlines : 'none',
    maxFlightsPerSearch,
});

if (maxFlightsPerSearch) {
    resultsStore.setMaxLimit(maxFlightsPerSearch);
}

const proxyConfiguration = await Actor.createProxyConfiguration({
    groups: ['RESIDENTIAL'],
});

const crawler = new PlaywrightCrawler({
    proxyConfiguration,
    maxConcurrency: 3,
    headless: true,
    requestHandler: async (context) => {
        if (resultsStore.isReachLimit()) {
            log.info('Flight limit reached, skipping request', { label: context.request.label });
            context.request.noRetry = true;
            return;
        }
        await router(context);
    },
    navigationTimeoutSecs: 60,
    preNavigationHooks: [captureSSEResponseHook, captureResponseHook],
    launchContext: {
        launchOptions: {
            args: ['--disable-gpu'],
        },
    },
});

const modules = [DirectRouteModule, AlternativeRouteModule];

const startUrls = modules.flatMap((module) =>
    module.createSearchInfos(input, timePeriods).map((searchInfo) =>
        createPipelineRequest({ pipelineName: module.pipelineName, stepIndex: 0, searchInfo }),
    ),
);

await crawler.run(startUrls);

const sortedResults = await resultsStore.getAllSorted();
log.info(`Crawler finished. Total results collected: ${sortedResults.length}`);

if (sortedResults.length === 0) {
    log.warning('No flight results found. Try adjusting search criteria or time periods.');
    await Actor.exit('No flights found matching your criteria');
}

await Dataset.pushData(sortedResults);

const cheapestFlight = sortedResults[0];
const expensiveFlight = sortedResults[sortedResults.length - 1];
const priceRange = expensiveFlight.totalPrice - cheapestFlight.totalPrice;

log.info(`Saved ${sortedResults.length} sorted results to dataset`);
log.info(`Cheapest flight: ${cheapestFlight.totalPrice} TWD (${cheapestFlight.pattern})`);
log.info(`Price range: ${cheapestFlight.totalPrice} - ${expensiveFlight.totalPrice} TWD (Δ${priceRange} TWD)`);

await Actor.exit(
    `✅ Successfully found ${sortedResults.length} flight options! ` +
    `Cheapest: ${cheapestFlight.totalPrice} TWD via ${cheapestFlight.pattern}. ` +
    `Price range: ${priceRange} TWD.`
);
