import { log } from 'apify';
import type { PlaywrightCrawlingContext } from 'crawlee';

import type { FlightInfo } from './types.js';
import { waitForUserData } from './utils.js';

/**
 * Helper function to wait for and validate flight data from userData
 */
export async function getAndValidateFlightData(
    request: PlaywrightCrawlingContext['request'],
    page: PlaywrightCrawlingContext['page'],
    dataKey: string,
): Promise<FlightInfo[]> {
    const flightData = await waitForUserData<FlightInfo[]>(request, page, dataKey);

    if (!flightData) {
        log.error(`${dataKey} is still missing after 30 seconds.`);
        throw new Error(`Missing ${dataKey} after 30 seconds of waiting`);
    }

    return flightData;
}

/**
 * Helper function to validate required userData field
 */
export function validateUserData<T>(userData: unknown, fieldName: string, errorMessage?: string): T {
    if (!userData) {
        const message = errorMessage || `Missing ${fieldName}`;
        log.error(message);
        throw new Error(message);
    }
    return userData as T;
}
