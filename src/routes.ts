import { createPlaywrightRouter, Dataset } from 'crawlee';

import { LABELS, TOP_FLIGHTS_TO_COLLECT_LIMIT } from './constants.js';
import type { DirectRouteSearchInfo, FlightInfo } from './types.js';
import { combineOutboundInboundFlightInfo, createInboundUrl, waitForUserData } from './utils.js';

export const router = createPlaywrightRouter();

router.addHandler(LABELS.DIRECT_OUTBOUND, async ({ request, log, page, crawler }) => {
    const outboundFlightInfoList = await waitForUserData<FlightInfo[]>(request, page, 'outboundFlightInfoList');

    if (!outboundFlightInfoList) {
        log.error('Outbound flight data is still missing after 30 seconds.');
        throw new Error('Missing outbound flight data after 30 seconds of waiting');
    }
    const topFlightInfos = outboundFlightInfoList.slice(0, TOP_FLIGHTS_TO_COLLECT_LIMIT);

    const searchInfo = request.userData.searchInfo as DirectRouteSearchInfo;

    for (const flightInfo of topFlightInfos) {
        const inboundFlightSearchUrl = createInboundUrl({
            departureCityCode: searchInfo.departureCityCode,
            targetCityCode: searchInfo.targetCityCode,
            departureDate: searchInfo.departureDate,
            returnDate: searchInfo.returnDate,
            cabinClass: searchInfo.cabinClass,
            productId: flightInfo.productId,
            policyId: flightInfo.policyId,
            quantity: searchInfo.quantity,
        });

        await crawler.addRequests([
            {
                url: inboundFlightSearchUrl,
                label: LABELS.DIRECT_OUTBOUND,
                userData: {
                    outboundFlightInfo: flightInfo,
                    searchInfo,
                    pattern: request.userData.pattern,
                },
            },
        ]);
    }

    // const searchInfo = request.userData.searchInfo as AlternativeRouteSearchInfo;
    // if (searchInfo.step === ALTERNATIVE_ROUTE_STEPS.TO_INTERMEDIATE) {
    //     for (const flightInfo of topFlightInfos) {
    //         const inboundFlightSearchUrl = createInboundUrl({
    //             departureCityCode: searchInfo.intermediateCityCode,
    //             targetCityCode: searchInfo.targetCityCode,
    //             departureDate: searchInfo.departureDate,
    //             returnDate: searchInfo.returnDate,
    //             cabinClass: searchInfo.cabinClass,
    //             productId: flightInfo.productId,
    //             policyId: flightInfo.policyId,
    //             quantity: searchInfo.quantity,
    //         });

    //         await crawler.addRequests([
    //             {
    //                 url: inboundFlightSearchUrl,
    //                 label: LABELS.IN_BOUND,
    //                 userData: {
    //                     outboundFlightInfo: flightInfo,
    //                     searchInfo,
    //                     pattern: request.userData.pattern,
    //                 },
    //             },
    //         ]);
    //     }
    // }
});

router.addHandler(LABELS.DIRECT_INBOUND, async ({ request, page, log }) => {
    const inboundFlightInfoList = await waitForUserData<FlightInfo[]>(request, page, 'inboundFlightInfoList');

    if (!inboundFlightInfoList) {
        log.error('Inbound flight data is still missing after 30 seconds.');
        throw new Error('Missing inbound flight data after 30 seconds of waiting');
    }

    const outboundFlightInfo = request.userData.outboundFlightInfo as FlightInfo;

    const pattern = request.userData.pattern as string;

    if (!outboundFlightInfo) {
        log.error('No outbound flight info found in request.userData');
        throw new Error('Missing outbound flight info');
    }

    if (!inboundFlightInfoList) {
        log.error('Inbound flight info is not found in request.userData.');
        throw new Error('Missing inbound flight info');
    }

    const topFlightInfos = inboundFlightInfoList.slice(0, TOP_FLIGHTS_TO_COLLECT_LIMIT);

    const combineFlightInfoDatasetPromises = topFlightInfos.map(async (inboundFlightInfo) => {
        const combinedFlightInfo = combineOutboundInboundFlightInfo(outboundFlightInfo, inboundFlightInfo);
        return await Dataset.pushData({
            pattern,
            flightInfo: combinedFlightInfo,
        });
    });

    await Promise.all(combineFlightInfoDatasetPromises);

    // const searchInfo = request.userData.searchInfo as AlternativeRouteSearchInfo;
    // if (searchInfo.step === ALTERNATIVE_ROUTE_STEPS.TO_INTERMEDIATE) {
    //     const combineFlightInfoDatasetPromises = topFlightInfos.map(async (inboundFlightInfo) => {
    //         const combinedFlightInfo = combineOutboundInboundFlightInfo(outboundFlightInfo, inboundFlightInfo);
    //         return await crawler.addRequests([
    //             {
    //                 url: inboundFlightSearchUrl,
    //                 label: LABELS.IN_BOUND,
    //                 userData: {
    //                     outboundFlightInfo: flightInfo,
    //                     searchInfo,
    //                     pattern: request.userData.pattern,
    //                 },
    //             },
    //         ]);
    //     });
    //     await Promise.all(combineFlightInfoDatasetPromises);
    // }
});
