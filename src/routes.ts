import { createPlaywrightRouter } from 'crawlee';

import { LABELS, PATTERN, TOP_FLIGHTS_TO_COLLECT_LIMIT } from './constants.js';
import { getAndValidateFlightData } from './helpers.js';
import { resultsStore } from './ResultsStore.js';
import type {
    AltInboundLeg1UserData,
    AltInboundLeg2UserData,
    AltOutboundLeg1UserData,
    AltOutboundLeg2UserData,
    DirectInboundUserData,
    DirectOutboundUserData,
    FlightInfo,
} from './types.js';
import { combineAlternativeRouteFlightInfo, combineOutboundInboundFlightInfo, createRequest } from './utils.js';

export const router = createPlaywrightRouter();

/**
 * Direct Route: Step 1/2 - Outbound Flight Search
 * Searches for outbound flights from departure to target city
 * Queues top N flights for inbound search
 */
router.addHandler<DirectOutboundUserData>(LABELS.DIRECT_OUTBOUND, async ({ request, crawler }) => {
    const { searchInfo } = request.userData;
    const outboundFlightInfoList = await getAndValidateFlightData(request, 'sseResponsePromise');
    const topFlightInfos = outboundFlightInfoList.slice(0, TOP_FLIGHTS_TO_COLLECT_LIMIT);

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
router.addHandler<DirectInboundUserData>(LABELS.DIRECT_INBOUND, async ({ request }) => {
    const { outboundFlightInfo, searchInfo } = request.userData;
    const inboundFlightInfoList = await getAndValidateFlightData(request, 'flightResponsePromise');
    const topFlightInfos = inboundFlightInfoList.slice(0, TOP_FLIGHTS_TO_COLLECT_LIMIT);

    const results = topFlightInfos.map((inboundFlightInfo) => {
        const combinedFlightInfo = combineOutboundInboundFlightInfo(outboundFlightInfo, inboundFlightInfo);
        return {
            pattern: PATTERN.DIRECT_ROUTE,
            totalPrice: combinedFlightInfo.totalPrice,
            mainDepartureCity: combinedFlightInfo.departureCityCode,
            intermediateCity: null,
            targetCity: combinedFlightInfo.targetCityCode,
            departureDate: searchInfo.departureDate,
            returnDate: searchInfo.returnDate,
            totalTimeMinutes: combinedFlightInfo.totalTimeMinutes,
            flightInfo: combinedFlightInfo,
        };
    });

    await resultsStore.append(results);
});

/**
 * Alternative Route: Step 1/4 - Outbound Leg 1 (Departure → Intermediate)
 * Searches for outbound flights from departure to intermediate city
 * Queues top N flights for outbound leg 2 search
 */
router.addHandler<AltOutboundLeg1UserData>(LABELS.ALT_OUTBOUND_LEG1, async ({ request, crawler }) => {
    const { searchInfo } = request.userData;
    const outboundFlightInfoList = await getAndValidateFlightData(request, 'sseResponsePromise');
    const topFlightInfos = outboundFlightInfoList.slice(0, TOP_FLIGHTS_TO_COLLECT_LIMIT);

    const requests = topFlightInfos.map((flightInfo) =>
        createRequest({
            label: LABELS.ALT_OUTBOUND_LEG2,
            searchInfo,
            outboundFlightInfo: flightInfo,
        }),
    );

    await crawler.addRequests(requests);
});

/**
 * Alternative Route: Step 2/4 - Outbound Leg 2 (Intermediate → Target)
 * Searches for flights from intermediate to target city
 * Combines outbound legs 1+2 and queues for inbound leg 1 search
 */
router.addHandler<AltOutboundLeg2UserData>(LABELS.ALT_OUTBOUND_LEG2, async ({ request, crawler }) => {
    const { outboundFlightInfo, searchInfo } = request.userData;
    const inboundFlightInfoList = await getAndValidateFlightData(request, 'flightResponsePromise');
    const topFlightInfo = inboundFlightInfoList[0];

    const leg1FlightInfo = combineOutboundInboundFlightInfo(outboundFlightInfo, topFlightInfo);

    const nextRequest = createRequest({
        label: LABELS.ALT_INBOUND_LEG1,
        searchInfo,
        leg1FlightInfo,
    });

    await crawler.addRequests([nextRequest]);
});

/**
 * Alternative Route: Step 3/4 - Inbound Leg 1 (Target → Intermediate)
 * Searches for return flights from target to intermediate city
 * Queues top N flights for inbound leg 2 search
 */
router.addHandler<AltInboundLeg1UserData>(LABELS.ALT_INBOUND_LEG1, async ({ request, crawler }) => {
    const { searchInfo, leg1FlightInfo } = request.userData;
    const outboundFlightInfoList = await getAndValidateFlightData(request, 'sseResponsePromise');
    const topFlightInfos = outboundFlightInfoList.slice(0, TOP_FLIGHTS_TO_COLLECT_LIMIT);

    const requests = topFlightInfos.map((flightInfo) =>
        createRequest({
            label: LABELS.ALT_INBOUND_LEG2,
            searchInfo,
            outboundFlightInfo: flightInfo,
            leg1FlightInfo,
        }),
    );

    await crawler.addRequests(requests);
});

/**
 * Alternative Route: Step 4/4 - Inbound Leg 2 (Intermediate → Departure)
 * Searches for final leg from intermediate back to departure city
 * Combines all 4 legs and saves complete alternative route to dataset
 */
router.addHandler<AltInboundLeg2UserData>(LABELS.ALT_INBOUND_LEG2, async ({ request }) => {
    const { outboundFlightInfo, leg1FlightInfo, searchInfo } = request.userData;
    const inboundFlightInfoList = await getAndValidateFlightData(request, 'flightResponsePromise');
    const topFlightInfos = inboundFlightInfoList.slice(0, TOP_FLIGHTS_TO_COLLECT_LIMIT);

    const combineFlightInfoList = topFlightInfos.map((inboundFlightInfo: FlightInfo) =>
        combineOutboundInboundFlightInfo(outboundFlightInfo, inboundFlightInfo),
    );

    const results = combineFlightInfoList.map((combinedFlightInfo: FlightInfo) => {
        const finalCombinedFlightInfo = combineAlternativeRouteFlightInfo(leg1FlightInfo, combinedFlightInfo);
        return {
            pattern: PATTERN.ALTERNATIVE_ROUTE,
            totalPrice: finalCombinedFlightInfo.totalPrice,
            mainDepartureCity: finalCombinedFlightInfo.departureCityCode,
            intermediateCity: searchInfo.intermediateCityCode,
            targetCity: finalCombinedFlightInfo.targetCityCode,
            departureDate: searchInfo.departureDate,
            returnDate: searchInfo.returnDate,
            totalTimeMinutes: finalCombinedFlightInfo.totalTimeMinutes,
            flightInfo: finalCombinedFlightInfo,
        };
    });

    await resultsStore.append(results);
});
