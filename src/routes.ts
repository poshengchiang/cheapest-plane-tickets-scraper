import { createPlaywrightRouter, Dataset } from 'crawlee';

import { LABELS, TOP_FLIGHTS_TO_COLLECT_LIMIT } from './constants.js';
import type { AlternativeRouteSearchInfo, DirectRouteSearchInfo, FlightInfo } from './types.js';
import { combineOutboundInboundFlightInfo, createInboundUrl, createOutBoundUrl, waitForUserData } from './utils.js';

export const router = createPlaywrightRouter();

/**
 * Handlers for Direct route
 */
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
                label: LABELS.DIRECT_INBOUND,
                userData: {
                    outboundFlightInfo: flightInfo,
                    searchInfo,
                },
            },
        ]);
    }
});

router.addHandler(LABELS.DIRECT_INBOUND, async ({ request, page, log }) => {
    const inboundFlightInfoList = await waitForUserData<FlightInfo[]>(request, page, 'inboundFlightInfoList');

    if (!inboundFlightInfoList) {
        log.error('Inbound flight data is still missing after 30 seconds.');
        throw new Error('Missing inbound flight data after 30 seconds of waiting');
    }

    const outboundFlightInfo = request.userData.outboundFlightInfo as FlightInfo;

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
            flightInfo: combinedFlightInfo,
        });
    });

    await Promise.all(combineFlightInfoDatasetPromises);
});

/**
 * Handlers for Alternative route
 */
router.addHandler(LABELS.ALT_LEG1_OUTBOUND, async ({ request, log, page, crawler }) => {
    const outboundFlightInfoList = await waitForUserData<FlightInfo[]>(request, page, 'outboundFlightInfoList');
    if (!outboundFlightInfoList) {
        log.error('Outbound flight data is still missing after 30 seconds.');
        throw new Error('Missing outbound flight data after 30 seconds of waiting');
    }
    const topFlightInfos = outboundFlightInfoList.slice(0, TOP_FLIGHTS_TO_COLLECT_LIMIT);

    const searchInfo = request.userData.searchInfo as AlternativeRouteSearchInfo;

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
                label: LABELS.ALT_LEG1_INBOUND,
                userData: {
                    outboundFlightInfo: flightInfo,
                    searchInfo,
                },
            },
        ]);
    }
});

router.addHandler(LABELS.ALT_LEG1_INBOUND, async ({ request, log, page, crawler }) => {
    const inboundFlightInfoList = await waitForUserData<FlightInfo[]>(request, page, 'inboundFlightInfoList');

    if (!inboundFlightInfoList) {
        log.error('Inbound flight data is still missing after 30 seconds.');
        throw new Error('Missing inbound flight data after 30 seconds of waiting');
    }

    const outboundFlightInfo = request.userData.outboundFlightInfo as FlightInfo;

    if (!outboundFlightInfo) {
        log.error('No outbound flight info found in request.userData');
        throw new Error('Missing outbound flight info');
    }

    const searchInfo = request.userData.searchInfo as AlternativeRouteSearchInfo;
    const topFlightInfo = inboundFlightInfoList[0];

    const combinedFlightInfo = combineOutboundInboundFlightInfo(outboundFlightInfo, topFlightInfo);

    const url = createOutBoundUrl({
        departureCityCode: searchInfo.intermediateCityCode,
        targetCityCode: searchInfo.targetCityCode,
        departureDate: searchInfo.departureDate,
        returnDate: searchInfo.returnDate,
        cabinClass: searchInfo.cabinClass,
        quantity: searchInfo.quantity,
    });

    await crawler.addRequests([
        {
            url,
            label: LABELS.ALT_LEG2_OUTBOUND,
            userData: {
                searchInfo,
                leg1FLightInfo: combinedFlightInfo,
            },
        },
    ]);
});

router.addHandler(LABELS.ALT_LEG2_OUTBOUND, async ({ request, log, page, crawler }) => {});

router.addHandler(LABELS.ALT_LEG2_INBOUND, async ({ request, page, log }) => {});
