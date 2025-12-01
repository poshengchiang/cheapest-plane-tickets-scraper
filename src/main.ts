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
import { captureSSEResponseHook } from './hooks.js';
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
    preNavigationHooks: [captureSSEResponseHook],
    launchContext: {
        launchOptions: {
            args: [
                '--disable-gpu', // Mitigates the "crashing GPU process" issue in Docker containers
            ],
        },
    },
});

const startUrls = [{ url: 'https://tw.trip.com/', label: LABELS.START, userData: input }];

await crawler.run(startUrls);

// Exit successfully
await Actor.exit();
