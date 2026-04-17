import { createPlaywrightRouter } from 'crawlee';

import { LABELS, PATTERN } from './constants.js';
import { getAndValidateFlightData } from './helpers.js';
import { PIPELINES } from './pipeline.js';
import { resultsStore } from './ResultsStore.js';
import type { AlternativeRouteSearchInfo, PipelineUserData } from './types.js';
import { combineAlternativeRouteFlightInfo, combineOutboundInboundFlightInfo, createPipelineRequest } from './utils.js';

export const router = createPlaywrightRouter();

router.addHandler<PipelineUserData>(LABELS.SEARCH_OUTBOUND, async ({ request, crawler }) => {
    const { pipelineName, stepIndex, searchInfo, combinedFlight } = request.userData;
    const step = PIPELINES[pipelineName][stepIndex];

    const flights = await getAndValidateFlightData(request, 'sseResponsePromise');

    const nextRequests = flights.slice(0, step.fanOut).map((flight) =>
        createPipelineRequest({
            pipelineName,
            stepIndex: stepIndex + 1,
            searchInfo,
            lastFlight: flight,
            combinedFlight,
        }),
    );

    await crawler.addRequests(nextRequests);
});

router.addHandler<PipelineUserData>(LABELS.SEARCH_INBOUND, async ({ request, crawler }) => {
    const { pipelineName, stepIndex, searchInfo, lastFlight, combinedFlight } = request.userData;
    const step = PIPELINES[pipelineName][stepIndex];

    const flights = await getAndValidateFlightData(request, 'flightResponsePromise');

    for (const flight of flights.slice(0, step.fanOut)) {
        const combined = combineOutboundInboundFlightInfo(lastFlight!, flight);

        switch (step.role) {
            case 'combine':
                await crawler.addRequests([
                    createPipelineRequest({
                        pipelineName,
                        stepIndex: stepIndex + 1,
                        searchInfo,
                        combinedFlight: combined,
                    }),
                ]);
                break;

            case 'save':
                await resultsStore.append([{
                    pattern: PATTERN.DIRECT_ROUTE,
                    totalPrice: combined.totalPrice,
                    mainDepartureCity: combined.departureCityCode,
                    intermediateCity: null,
                    targetCity: combined.targetCityCode,
                    departureDate: searchInfo.departureDate,
                    returnDate: searchInfo.returnDate,
                    totalTimeMinutes: combined.totalTimeMinutes,
                    flightInfo: combined,
                }]);
                break;

            case 'merge-save': {
                const final = combineAlternativeRouteFlightInfo(combinedFlight!, combined);
                const altInfo = searchInfo as AlternativeRouteSearchInfo;
                await resultsStore.append([{
                    pattern: PATTERN.ALTERNATIVE_ROUTE,
                    totalPrice: final.totalPrice,
                    mainDepartureCity: final.departureCityCode,
                    intermediateCity: altInfo.intermediateCityCode,
                    targetCity: final.targetCityCode,
                    departureDate: searchInfo.departureDate,
                    returnDate: searchInfo.returnDate,
                    totalTimeMinutes: final.totalTimeMinutes,
                    flightInfo: final,
                }]);
                break;
            }

            default:
                throw new Error(`Unexpected step role in SEARCH_INBOUND handler: ${step.role}`);
        }
    }
});
