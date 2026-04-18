import { createPlaywrightRouter } from 'crawlee';

import { LABELS } from './constants.js';
import { getAndValidateFlightData } from './helpers.js';
import { PIPELINES } from './pipeline.js';
import { resultsStore } from './ResultsStore.js';
import type { PipelineUserData } from './types.js';
import { createPipelineRequest } from './utils.js';

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

    if (step.handler !== 'inbound') {
        throw new Error(`Unexpected outbound step '${step.name}' in SEARCH_INBOUND handler`);
    }

    const flights = await getAndValidateFlightData(request, 'flightResponsePromise');

    for (const flight of flights.slice(0, step.fanOut)) {
        const result = step.execute({ flight, lastFlight, combinedFlight, searchInfo });

        if (result.type === 'advance') {
            await crawler.addRequests([
                createPipelineRequest({
                    pipelineName,
                    stepIndex: stepIndex + 1,
                    searchInfo,
                    combinedFlight: result.combinedFlight,
                }),
            ]);
        } else {
            await resultsStore.append(result.results);
        }
    }
});
