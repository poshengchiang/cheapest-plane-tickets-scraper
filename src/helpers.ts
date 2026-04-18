import { log } from 'apify';
import type { PlaywrightCrawlingContext } from 'crawlee';

import type { FlightInfo } from './types.js';

export async function getAndValidateFlightData(
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
