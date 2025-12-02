import { Dataset, log } from 'apify';
import type { PlaywrightHook } from 'crawlee';

import { extractOutboundFlightData } from './utils.js';

/**
 * Pre-navigation hook to capture SSE (Server-Sent Events) responses from Trip.com API
 */
export const captureSSEResponseHook: PlaywrightHook = async ({ page, request }) => {
    // Set up response listener BEFORE navigation
    page.on('response', async (response) => {
        if (response.url().includes('FlightListSearchSSE') && response.status() === 200) {
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

                const extractedFlightData = extractOutboundFlightData(responseData);
                if (extractedFlightData) {
                    request.userData.outboundData = extractedFlightData;
                    // Store in userData so requestHandler can access it
                    log.info('Captured SSE response');
                } else {
                    log.warning('No flight data extracted from SSE response');
                }
            } catch (error) {
                log.error('Failed to parse SSE response', { error });
            }
        }
    });
};
