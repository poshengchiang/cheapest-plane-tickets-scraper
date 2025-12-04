import { createPlaywrightRouter, Dataset } from 'crawlee';

import { LABELS, PATTERN, TOP_FLIGHTS_TO_COLLECT_LIMIT } from './constants.js';
import { getAndValidateFlightData, validateUserData } from './helpers.js';
import type { AlternativeRouteSearchInfo, DirectRouteSearchInfo, FlightInfo } from './types.js';
import { combineAlternativeRouteFlightInfo, combineOutboundInboundFlightInfo, createRequest } from './utils.js';

export const router = createPlaywrightRouter();

/**
 * Handlers for Direct route
 */
router.addHandler(LABELS.DIRECT_OUTBOUND, async ({ request, page, crawler }) => {
    const outboundFlightInfoList = await getAndValidateFlightData(request, page, 'outboundFlightInfoList');
    const topFlightInfos = outboundFlightInfoList.slice(0, TOP_FLIGHTS_TO_COLLECT_LIMIT);
    const searchInfo = validateUserData<DirectRouteSearchInfo>(request.userData.searchInfo, 'searchInfo');

    const requests = topFlightInfos.map((flightInfo) =>
        createRequest({
            label: LABELS.DIRECT_INBOUND,
            searchInfo,
            outboundFlightInfo: flightInfo,
        }),
    );

    await crawler.addRequests(requests);
});

router.addHandler(LABELS.DIRECT_INBOUND, async ({ request, page }) => {
    const inboundFlightInfoList = await getAndValidateFlightData(request, page, 'inboundFlightInfoList');
    const outboundFlightInfo = validateUserData<FlightInfo>(request.userData.outboundFlightInfo, 'outboundFlightInfo');
    const topFlightInfos = inboundFlightInfoList.slice(0, TOP_FLIGHTS_TO_COLLECT_LIMIT);

    await Promise.all(
        topFlightInfos.map(async (inboundFlightInfo: FlightInfo) => {
            const combinedFlightInfo = combineOutboundInboundFlightInfo(outboundFlightInfo, inboundFlightInfo);
            return await Dataset.pushData({
                pattern: PATTERN.DIRECT_ROUTE,
                flightInfo: combinedFlightInfo,
            });
        }),
    );
});

/**
 * Handlers for Alternative route
 */
router.addHandler(LABELS.ALT_LEG1_OUTBOUND, async ({ request, page, crawler }) => {
    const outboundFlightInfoList = await getAndValidateFlightData(request, page, 'outboundFlightInfoList');
    const topFlightInfos = outboundFlightInfoList.slice(0, TOP_FLIGHTS_TO_COLLECT_LIMIT);
    const searchInfo = validateUserData<AlternativeRouteSearchInfo>(request.userData.searchInfo, 'searchInfo');

    const requests = topFlightInfos.map((flightInfo) =>
        createRequest({
            label: LABELS.ALT_LEG1_INBOUND,
            searchInfo,
            outboundFlightInfo: flightInfo,
        }),
    );

    await crawler.addRequests(requests);
});

router.addHandler(LABELS.ALT_LEG1_INBOUND, async ({ request, page, crawler }) => {
    const inboundFlightInfoList = await getAndValidateFlightData(request, page, 'inboundFlightInfoList');
    const outboundFlightInfo = validateUserData<FlightInfo>(request.userData.outboundFlightInfo, 'outboundFlightInfo');
    const searchInfo = validateUserData<AlternativeRouteSearchInfo>(request.userData.searchInfo, 'searchInfo');
    const topFlightInfo = inboundFlightInfoList[0];

    const leg1FlightInfo = combineOutboundInboundFlightInfo(outboundFlightInfo, topFlightInfo);

    const nextRequest = createRequest({
        label: LABELS.ALT_LEG2_OUTBOUND,
        searchInfo,
        leg1FlightInfo,
    });

    await crawler.addRequests([nextRequest]);
});

router.addHandler(LABELS.ALT_LEG2_OUTBOUND, async ({ request, page, crawler }) => {
    const outboundFlightInfoList = await getAndValidateFlightData(request, page, 'outboundFlightInfoList');
    const topFlightInfos = outboundFlightInfoList.slice(0, TOP_FLIGHTS_TO_COLLECT_LIMIT);
    const searchInfo = validateUserData<AlternativeRouteSearchInfo>(request.userData.searchInfo, 'searchInfo');
    const leg1FlightInfo = validateUserData<FlightInfo>(request.userData.leg1FlightInfo, 'leg1FlightInfo');

    const requests = topFlightInfos.map((flightInfo) =>
        createRequest({
            label: LABELS.ALT_LEG2_INBOUND,
            searchInfo,
            outboundFlightInfo: flightInfo,
            leg1FlightInfo,
        }),
    );

    await crawler.addRequests(requests);
});

router.addHandler(LABELS.ALT_LEG2_INBOUND, async ({ request, page }) => {
    const inboundFlightInfoList = await getAndValidateFlightData(request, page, 'inboundFlightInfoList');
    const outboundFlightInfo = validateUserData<FlightInfo>(request.userData.outboundFlightInfo, 'outboundFlightInfo');
    const leg1FlightInfo = validateUserData<FlightInfo>(request.userData.leg1FlightInfo, 'leg1FlightInfo');
    const topFlightInfos = inboundFlightInfoList.slice(0, TOP_FLIGHTS_TO_COLLECT_LIMIT);

    const combineFlightInfoList = topFlightInfos.map((inboundFlightInfo: FlightInfo) =>
        combineOutboundInboundFlightInfo(outboundFlightInfo, inboundFlightInfo),
    );

    await Promise.all(
        combineFlightInfoList.map(async (combinedFlightInfo: FlightInfo) => {
            const finalCombinedFlightInfo = combineAlternativeRouteFlightInfo(leg1FlightInfo, combinedFlightInfo);
            return await Dataset.pushData({
                pattern: PATTERN.ALTERNATIVE_ROUTE,
                flightInfo: finalCombinedFlightInfo,
            });
        }),
    );
});
