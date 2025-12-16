import { log } from 'apify';
import type { PlaywrightHook } from 'crawlee';

import { LABELS } from './constants.js';
import { extractFlightData } from './utils.js';

/**
 * Pre-navigation hook to capture SSE (Server-Sent Events) responses from Trip.com API
 * Sets up a promise that waits for the response and stores it in request.userData for the handler to await
 */
export const captureSSEResponseHook: PlaywrightHook = async ({ page, request }, gotoOptions) => {
    if (
        request.label !== LABELS.DIRECT_OUTBOUND &&
        request.label !== LABELS.ALT_LEG1_OUTBOUND &&
        request.label !== LABELS.ALT_LEG2_OUTBOUND
    ) {
        return;
    }

    // eslint-disable-next-line no-param-reassign
    gotoOptions.waitUntil = 'domcontentloaded';

    // Store the response promise in userData for the handler to await
    request.userData.sseResponsePromise = page
        .waitForResponse(
            (response) => response.url().endsWith('FlightListSearchSSE') && response.status() === 200,
            { timeout: 60000 },
        )
        .then(async (response) => {
            try {
                const text = await response.text();

                // Parse SSE events
                const lines = text.split('\n');

                let responseData = null;

                for (const line of lines) {
                    if (line.startsWith('data:')) {
                        const data = line.slice(5).trim(); // Remove 'data:' prefix and trim
                        if (data) {
                            try {
                                responseData = JSON.parse(data);
                            } catch {
                                log.warning(`Failed to parse SSE line: ${line.substring(0, 100)}`);
                            }
                        }
                    }
                }

                const extractedFlightsData = extractFlightData(responseData);
                if (extractedFlightsData) {
                    return extractedFlightsData;
                }
                log.warning('No flight data extracted from SSE response');
                return null;
            } catch (error) {
                log.error('Failed to parse SSE response', { error });
                return null;
            }
        })
        .catch((error) => {
            log.error('SSE response wait failed', { error });
            return null;
        });
};

/**
 * Pre-navigation hook to capture flight search responses from Trip.com API
 * Sets up a promise that waits for the response and stores it in request.userData for the handler to await
 */
export const captureResponseHook: PlaywrightHook = async ({ page, request }, gotoOptions) => {
    if (
        request.label !== LABELS.DIRECT_INBOUND &&
        request.label !== LABELS.ALT_LEG2_INBOUND &&
        request.label !== LABELS.ALT_LEG1_INBOUND
    ) {
        return;
    }

    // eslint-disable-next-line no-param-reassign
    gotoOptions.waitUntil = 'domcontentloaded';

    // Store the response promise in userData for the handler to await
    request.userData.flightResponsePromise = page
        .waitForResponse(
            (response) => response.url().endsWith('FlightListSearch') && response.status() === 200,
            { timeout: 60000 },
        )
        .then(async (response) => {
            try {
                const json = await response.json();
                const extractedFlightsData = extractFlightData(json);
                if (extractedFlightsData) {
                    return extractedFlightsData;
                }
                log.warning('No flight data extracted from flight search response');
                return null;
            } catch (error) {
                log.error('Failed to parse flight search response', { error });
                return null;
            }
        })
        .catch((error) => {
            log.error('Flight response wait failed', { error });
            return null;
        });
};
