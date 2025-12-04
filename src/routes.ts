import { createPlaywrightRouter, Dataset } from 'crawlee';

import { LABELS, PATTERN, TOP_FLIGHTS_TO_COLLECT_LIMIT } from './constants.js';
import { getAndValidateFlightData, validateUserData } from './helpers.js';
import type { AlternativeRouteSearchInfo, DirectRouteSearchInfo, FlightInfo } from './types.js';
import { combineAlternativeRouteFlightInfo, combineOutboundInboundFlightInfo, createRequest } from './utils.js';

export const router = createPlaywrightRouter();

/**
 * Direct Route: Step 1/2 - Outbound Flight Search
 * Searches for outbound flights from departure to target city
 * Queues top N flights for inbound search
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

/**
 * Direct Route: Step 2/2 - Inbound Flight Search
 * Searches for return flights from target back to departure city
 * Combines with outbound flight and saves to dataset
 */
router.addHandler(LABELS.DIRECT_INBOUND, async ({ request, page }) => {
    const inboundFlightInfoList = await getAndValidateFlightData(request, page, 'inboundFlightInfoList');
    const outboundFlightInfo = validateUserData<FlightInfo>(request.userData.outboundFlightInfo, 'outboundFlightInfo');
    const topFlightInfos = inboundFlightInfoList.slice(0, TOP_FLIGHTS_TO_COLLECT_LIMIT);

    await Promise.all(
        topFlightInfos.map(async (inboundFlightInfo) => {
            const combinedFlightInfo = combineOutboundInboundFlightInfo(outboundFlightInfo, inboundFlightInfo);
            return Dataset.pushData({
                pattern: PATTERN.DIRECT_ROUTE,
                flightInfo: combinedFlightInfo,
            });
        }),
    );
});

/**
 * Alternative Route: Step 1/4 - Leg 1 Outbound (Departure → Intermediate)
 * Searches for outbound flights from departure to intermediate city
 * Queues top N flights for leg 1 inbound search
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

/**
 * Alternative Route: Step 2/4 - Leg 1 Inbound (Intermediate → Target)
 * Searches for flights from intermediate to target city
 * Combines leg 1 outbound + inbound and queues for leg 2 outbound
 */
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

/**
 * Alternative Route: Step 3/4 - Leg 2 Outbound (Target → Intermediate)
 * Searches for return flights from target to intermediate city
 * Queues top N flights for leg 2 inbound search
 */
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

/**
 * Alternative Route: Step 4/4 - Leg 2 Inbound (Intermediate → Departure)
 * Searches for final leg from intermediate back to departure city
 * Combines all 4 legs and saves complete alternative route to dataset
 */
router.addHandler(LABELS.ALT_LEG2_INBOUND, async ({ request, page }) => {
    const inboundFlightInfoList = await getAndValidateFlightData(request, page, 'inboundFlightInfoList');
    const outboundFlightInfo = validateUserData<FlightInfo>(request.userData.outboundFlightInfo, 'outboundFlightInfo');
    const leg1FlightInfo = validateUserData<FlightInfo>(request.userData.leg1FlightInfo, 'leg1FlightInfo');
    const topFlightInfos = inboundFlightInfoList.slice(0, TOP_FLIGHTS_TO_COLLECT_LIMIT);

    const combineFlightInfoList = topFlightInfos.map((inboundFlightInfo: FlightInfo) =>
        combineOutboundInboundFlightInfo(outboundFlightInfo, inboundFlightInfo),
    );

    const searchInfo = validateUserData<AlternativeRouteSearchInfo>(request.userData.searchInfo, 'searchInfo');

    await Promise.all(
        combineFlightInfoList.map(async (combinedFlightInfo: FlightInfo) => {
            const finalCombinedFlightInfo = combineAlternativeRouteFlightInfo(leg1FlightInfo, combinedFlightInfo);
            return Dataset.pushData({
                pattern: PATTERN.ALTERNATIVE_ROUTE,
                intermediateCityCode: searchInfo.intermediateCityCode,
                intermediateCityName: leg1FlightInfo.targetCityName,
                flightInfo: finalCombinedFlightInfo,
            });
        }),
    );
});
