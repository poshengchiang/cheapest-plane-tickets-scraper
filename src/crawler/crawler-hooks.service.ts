import { Injectable } from '@nestjs/common';
import { log } from 'apify';
import type { PlaywrightHook } from 'crawlee';

import { LABELS } from '../constants.js';
import { FlightDataService } from '../services/flight-data.service.js';
import type { InboundPipelineUserData, OutboundPipelineUserData } from '../types.js';

@Injectable()
export class CrawlerHooksService {
    constructor(private readonly flightDataService: FlightDataService) {}

    readonly sseHook: PlaywrightHook = async ({ page, request }, gotoOptions) => {
        if (request.label !== LABELS.SEARCH_OUTBOUND) return;

        // eslint-disable-next-line no-param-reassign
        gotoOptions.waitUntil = 'domcontentloaded';

        (request.userData as OutboundPipelineUserData).sseResponsePromise = page
            .waitForResponse(
                (response) => response.url().endsWith('FlightListSearchSSE') && response.status() === 200,
                { timeout: 60000 },
            )
            .then(async (response) => {
                try {
                    const text = await response.text();
                    const lines = text.split('\n');
                    let responseData = null;

                    for (const line of lines) {
                        if (line.startsWith('data:')) {
                            const data = line.slice(5).trim();
                            if (data) {
                                try {
                                    responseData = JSON.parse(data);
                                } catch {
                                    log.warning(`Failed to parse SSE line: ${line.substring(0, 100)}`);
                                }
                            }
                        }
                    }

                    const extractedFlightsData = this.flightDataService.extractFlightData(responseData);
                    if (extractedFlightsData) return extractedFlightsData;
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

    readonly responseHook: PlaywrightHook = async ({ page, request }, gotoOptions) => {
        if (request.label !== LABELS.SEARCH_INBOUND) return;

        // eslint-disable-next-line no-param-reassign
        gotoOptions.waitUntil = 'domcontentloaded';

        (request.userData as InboundPipelineUserData).flightResponsePromise = page
            .waitForResponse(
                (response) => response.url().endsWith('FlightListSearch') && response.status() === 200,
                { timeout: 60000 },
            )
            .then(async (response) => {
                try {
                    const json = await response.json();
                    const extractedFlightsData = this.flightDataService.extractFlightData(json);
                    if (extractedFlightsData) return extractedFlightsData;
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
}
