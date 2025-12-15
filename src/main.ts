/**
 * This template is a production ready boilerplate for developing with `PlaywrightCrawler`.
 * Use this to bootstrap your projects using the most up-to-date code.
 * If you're looking for examples or want to learn more, see README.
 */

// For more information, see https://docs.apify.com/sdk/js
import { Actor, Dataset, log } from 'apify';
// For more information, see https://crawlee.dev
import { PlaywrightCrawler } from 'crawlee';

// this is ESM project, and as such, it requires you to specify extensions in your relative imports
// read more about this here: https://nodejs.org/docs/latest-v18.x/api/esm.html#mandatory-file-extensions
// note that we need to use `.js` even when inside TS files
import { LABELS } from './constants.js';
import { captureResponseHook, captureSSEResponseHook } from './hooks.js';
import { resultsStore } from './ResultsStore.js';
import { router } from './routes.js';
import type { Input } from './types.js';
import { createRequest } from './utils.js';

// Initialize the Apify SDK
await Actor.init();

// Read input from Actor configuration
const input = (await Actor.getInput<Input>()) ?? ({} as Input);

// Validate required inputs
if (!input.mainDepartureCity || !input.targetCity || !input.timePeriods || input.timePeriods.length === 0) {
    throw new Error('Missing required input: mainDepartureCity, targetCity, and timePeriods are required');
}

// Extract parameters with defaults
const {
    mainDepartureCity,
    targetCity,
    alternativeDepartureCities = [],
    cabinClass,
    numberOfPeople,
    timePeriods,
    airlines = [],
    maxFlightsPerSearch,
} = input;

log.info('Actor input received:', {
    mainDepartureCity,
    targetCity,
    alternativeDepartureCities,
    cabinClass,
    numberOfPeople,
    timePeriodsCount: timePeriods.length,
    airlinesFilter: airlines.length > 0 ? airlines : 'none',
    maxFlightsPerSearch,
});

// Set the maximum flights limit in results store
if (maxFlightsPerSearch) {
    resultsStore.setMaxLimit(maxFlightsPerSearch);
}

const proxyConfiguration = await Actor.createProxyConfiguration({
    groups: ['RESIDENTIAL'],
    countryCode: 'TW',
});

const crawler = new PlaywrightCrawler({
    proxyConfiguration,
    maxConcurrency: 3,
    headless: true,
    requestHandler: async (context) => {
        // Check limit before processing any route
        if (resultsStore.isReachLimit()) {
            log.info('Flight limit reached, skipping request', { 
                label: context.request.label 
            });
            context.request.noRetry = true;
            return;
        }
        // Process the route if limit not reached
        await router(context);
    },
    navigationTimeoutSecs: 60, // Increased for SSE responses that take longer
    preNavigationHooks: [captureSSEResponseHook, captureResponseHook],
    launchContext: {
        launchOptions: {
            args: [
                '--disable-gpu', // Mitigates the "crashing GPU process" issue in Docker containers
            ],
        },
    },
});

const startUrls: ReturnType<typeof createRequest>[] = [];

timePeriods.forEach((period) => {
    const { outboundDate, inboundDate } = period;

    // Create direct route request
    startUrls.push(
        createRequest({
            label: LABELS.DIRECT_OUTBOUND,
            searchInfo: {
                departureCityCode: mainDepartureCity,
                targetCityCode: targetCity,
                departureDate: outboundDate,
                returnDate: inboundDate,
                cabinClass,
                quantity: numberOfPeople,
                airlines,
            },
        }),
    );

    // Create alternative route requests
    alternativeDepartureCities.forEach((intermediateCity: string) => {
        startUrls.push(
            createRequest({
                label: LABELS.ALT_LEG1_OUTBOUND,
                searchInfo: {
                    departureCityCode: mainDepartureCity,
                    intermediateCityCode: intermediateCity,
                    targetCityCode: targetCity,
                    departureDate: outboundDate,
                    returnDate: inboundDate,
                    cabinClass,
                    quantity: numberOfPeople,
                    airlines,
                },
            }),
        );
    });
});

await crawler.run(startUrls);

// Retrieve and sort all results
const sortedResults = await resultsStore.getAllSorted();
log.info(`Crawler finished. Total results collected: ${sortedResults.length}`);

if (sortedResults.length === 0) {
    log.warning('No flight results found');
    await Actor.exit();
}

// Save sorted results to dataset
await Dataset.pushData(sortedResults);

log.info(`Saved ${sortedResults.length} sorted results to dataset`);
log.info(`Cheapest flight: ${sortedResults[0].totalPrice} TWD (${sortedResults[0].pattern})`);

// Exit successfully
await Actor.exit();
