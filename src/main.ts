/**
 * This template is a production ready boilerplate for developing with `PlaywrightCrawler`.
 * Use this to bootstrap your projects using the most up-to-date code.
 * If you're looking for examples or want to learn more, see README.
 */

// For more information, see https://docs.apify.com/sdk/js
import { Actor, log } from 'apify';
// For more information, see https://crawlee.dev
import { PlaywrightCrawler } from 'crawlee';

// this is ESM project, and as such, it requires you to specify extensions in your relative imports
// read more about this here: https://nodejs.org/docs/latest-v18.x/api/esm.html#mandatory-file-extensions
// note that we need to use `.js` even when inside TS files
import { LABELS, PATTERN } from './constants.js';
import { captureResponseHook, captureSSEResponseHook } from './hooks.js';
import { router } from './routes.js';
import type { Input } from './types.js';
import { createOutBoundUrl } from './utils.js';

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
    cabinClass = 'Economy',
    numberOfPeople = 1,
    timePeriods,
    airlines = [],
    maxRequestsPerCrawl = 1000,
} = input;

log.info('Actor input received:', {
    mainDepartureCity,
    targetCity,
    alternativeDepartureCities,
    cabinClass,
    numberOfPeople,
    timePeriodsCount: timePeriods.length,
    airlinesFilter: airlines.length > 0 ? airlines : 'none',
});

const proxyConfiguration = await Actor.createProxyConfiguration({
    groups: ['RESIDENTIAL'],
    countryCode: 'TW',
});

const crawler = new PlaywrightCrawler({
    proxyConfiguration,
    maxRequestsPerCrawl,
    headless: true,
    requestHandler: router,
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

const startUrls: DirectRouteRequest[] = [];

timePeriods.forEach((period) => {
    const request = createDirectRouteRequest(
        mainDepartureCity,
        targetCity,
        period.outboundDate,
        period.inboundDate,
        numberOfPeople,
        cabinClass,
    );
    startUrls.push(request);
});

await crawler.run(startUrls);

const dataset = await Actor.openDataset();
const { items } = await dataset.getData();
log.info(`Crawler finished. Total items saved to dataset: ${items.length}`);

const sortedItems = items.sort((a, b) => {
    return a.flightInfo.totalPrice - b.flightInfo.totalPrice;
});

await dataset.drop();

const sortedDataset = await Actor.openDataset();
await sortedDataset.pushData(sortedItems);

// Exit successfully
await Actor.exit();
