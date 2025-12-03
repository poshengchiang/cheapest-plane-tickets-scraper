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
import { LABELS } from './constants.js';
import { captureResponseHook, captureSSEResponseHook } from './hooks.js';
import { router } from './routes.js';
import type { DirectRouteRequest, Input } from './types.js';
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
    cabinClass,
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
    maxConcurrency: 3,
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
    const { outboundDate, inboundDate } = period;
    const directRouteUrl = createOutBoundUrl({
        departureCityCode: mainDepartureCity,
        targetCityCode: targetCity,
        departureDate: outboundDate,
        returnDate: inboundDate,
        quantity: numberOfPeople,
    });

    const directRouteRequest = {
        url: directRouteUrl,
        label: LABELS.DIRECT_OUTBOUND,
        userData: {
            searchInfo: {
                departureCityCode: mainDepartureCity,
                targetCityCode: targetCity,
                departureDate: outboundDate,
                returnDate: inboundDate,
                cabinClass,
                quantity: numberOfPeople,
            },
        },
    };

    startUrls.push(directRouteRequest);

    if (alternativeDepartureCities.length > 0) {
        alternativeDepartureCities.forEach((intermediateCity) => {
            const altUrl = createOutBoundUrl({
                departureCityCode: mainDepartureCity,
                targetCityCode: intermediateCity,
                departureDate: outboundDate,
                returnDate: inboundDate,
                quantity: numberOfPeople,
            });

            const altRouteRequest = {
                url: altUrl,
                label: LABELS.ALT_LEG1_OUTBOUND,
                userData: {
                    searchInfo: {
                        departureCityCode: mainDepartureCity,
                        intermediateCityCode: intermediateCity,
                        targetCityCode: targetCity,
                        departureDate: outboundDate,
                        returnDate: inboundDate,
                        cabinClass,
                        quantity: numberOfPeople,
                    },
                },
            };
            startUrls.push(altRouteRequest);
        });
    }
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
