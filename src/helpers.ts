import { log } from 'apify';
import type { PlaywrightCrawlingContext } from 'crawlee';

import type { FlightInfo } from './types.js';

/**
 * Helper function to wait for and validate flight data from request.userData promises
 */
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
