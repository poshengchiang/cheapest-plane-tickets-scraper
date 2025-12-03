import { log } from 'apify';
import type { PlaywrightHook } from 'crawlee';

import { LABELS } from './constants.js';
import { extractFlightData } from './utils.js';

/**
 * Pre-navigation hook to capture SSE (Server-Sent Events) responses from Trip.com API
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

    page.on('response', async (response) => {
        if (response.url().endsWith('FlightListSearchSSE') && response.status() === 200) {
            log.info(`Capturing SSE response from: ${response.url()}`);
            try {
                const text = await response.text();
                log.info(`SSE response text length: ${text.length}`);

                // Parse SSE events
                const lines = text.split('\n');

                let responseData = null;

                for (const line of lines) {
                    log.info(`SSE response line preview: ${line.slice(0, 300)}`);

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
                    // Store in userData so requestHandler can access it
                    log.info('Captured SSE response');
                    request.userData.outboundFlightInfoList = extractedFlightsData;
                } else {
                    log.warning('No flight data extracted from SSE response');
                }
            } catch (error) {
                log.error('Failed to parse SSE response', { error });
            }
        }
    });
};

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

    page.on('response', async (response) => {
        if (response.url().endsWith('FlightListSearch') && response.status() === 200) {
            log.info(`Capturing response from: ${response.url()}`);
            try {
                const text = await response.text();
                log.info(`Preview of response text: ${text.slice(0, 300)}`);

                const json = await response.json();
                const extractedFlightsData = extractFlightData(json);
                if (extractedFlightsData) {
                    // Store in userData so requestHandler can access it
                    log.info('Captured flight search response');
                    request.userData.inboundFlightInfoList = extractedFlightsData;
                } else {
                    log.warning('No flight data extracted from flight search response');
                }
            } catch (error) {
                log.error('Failed to parse flight search response', { error });
            }
        }
    });
};
