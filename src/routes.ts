import { createPlaywrightRouter, Dataset } from 'crawlee';

import { LABELS, PATTERN, TOP_FLIGHTS_TO_COLLECT_LIMIT } from './constants.js';
import { getAndValidateFlightData, validateUserData } from './helpers.js';
import type { AlternativeRouteSearchInfo, DirectRouteSearchInfo, FlightInfo } from './types.js';
import {
    combineAlternativeRouteFlightInfo,
    combineOutboundInboundFlightInfo,
    createInboundUrl,
    createOutBoundUrl,
} from './utils.js';

export const router = createPlaywrightRouter();

/**
 * Handlers for Direct route
 */
router.addHandler(LABELS.DIRECT_OUTBOUND, async ({ request, page, crawler }) => {
    const outboundFlightInfoList = await getAndValidateFlightData(request, page, 'outboundFlightInfoList');
    const topFlightInfos = outboundFlightInfoList.slice(0, TOP_FLIGHTS_TO_COLLECT_LIMIT);
    const searchInfo = validateUserData<DirectRouteSearchInfo>(request.userData.searchInfo, 'searchInfo');

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

router.addHandler(LABELS.DIRECT_INBOUND, async ({ request, page }) => {
    const inboundFlightInfoList = await getAndValidateFlightData(request, page, 'inboundFlightInfoList');
    const outboundFlightInfo = validateUserData<FlightInfo>(request.userData.outboundFlightInfo, 'outboundFlightInfo');
    const topFlightInfos = inboundFlightInfoList.slice(0, TOP_FLIGHTS_TO_COLLECT_LIMIT);

    const combineFlightInfoDatasetPromises = topFlightInfos.map(async (inboundFlightInfo: FlightInfo) => {
        const combinedFlightInfo = combineOutboundInboundFlightInfo(outboundFlightInfo, inboundFlightInfo);
        return await Dataset.pushData({
            pattern: PATTERN.DIRECT_ROUTE,
            flightInfo: combinedFlightInfo,
        });
    });

    await Promise.all(combineFlightInfoDatasetPromises);
});

/**
 * Handlers for Alternative route
 */
router.addHandler(LABELS.ALT_LEG1_OUTBOUND, async ({ request, page, crawler }) => {
    const outboundFlightInfoList = await getAndValidateFlightData(request, page, 'outboundFlightInfoList');
    const topFlightInfos = outboundFlightInfoList.slice(0, TOP_FLIGHTS_TO_COLLECT_LIMIT);
    const searchInfo = validateUserData<AlternativeRouteSearchInfo>(request.userData.searchInfo, 'searchInfo');

    for (const flightInfo of topFlightInfos) {
        const inboundFlightSearchUrl = createInboundUrl({
            departureCityCode: searchInfo.departureCityCode,
            targetCityCode: searchInfo.intermediateCityCode,
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

router.addHandler(LABELS.ALT_LEG1_INBOUND, async ({ request, page, crawler }) => {
    const inboundFlightInfoList = await getAndValidateFlightData(request, page, 'inboundFlightInfoList');
    const outboundFlightInfo = validateUserData<FlightInfo>(request.userData.outboundFlightInfo, 'outboundFlightInfo');
    const searchInfo = validateUserData<AlternativeRouteSearchInfo>(request.userData.searchInfo, 'searchInfo');
    const topFlightInfo = inboundFlightInfoList[0];

    const combinedFlightInfo = combineOutboundInboundFlightInfo(outboundFlightInfo, topFlightInfo);

    const url = createOutBoundUrl({
        departureCityCode: searchInfo.intermediateCityCode,
        targetCityCode: searchInfo.targetCityCode,
        departureDate: searchInfo.departureDate,
        returnDate: searchInfo.returnDate,
        cabinClass: searchInfo.cabinClass,
        quantity: searchInfo.quantity,
        airlines: searchInfo.airlines,
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

router.addHandler(LABELS.ALT_LEG2_OUTBOUND, async ({ request, page, crawler }) => {
    const outboundFlightInfoList = await getAndValidateFlightData(request, page, 'outboundFlightInfoList');
    const topFlightInfos = outboundFlightInfoList.slice(0, TOP_FLIGHTS_TO_COLLECT_LIMIT);
    const searchInfo = validateUserData<AlternativeRouteSearchInfo>(request.userData.searchInfo, 'searchInfo');
    const leg1FLightInfo = validateUserData<FlightInfo>(request.userData.leg1FLightInfo, 'leg1FLightInfo');

    for (const flightInfo of topFlightInfos) {
        const inboundFlightSearchUrl = createInboundUrl({
            departureCityCode: searchInfo.intermediateCityCode,
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
                label: LABELS.ALT_LEG2_INBOUND,
                userData: {
                    outboundFlightInfo: flightInfo,
                    searchInfo,
                    leg1FLightInfo,
                },
            },
        ]);
    }
});

router.addHandler(LABELS.ALT_LEG2_INBOUND, async ({ request, page }) => {
    const inboundFlightInfoList = await getAndValidateFlightData(request, page, 'inboundFlightInfoList');
    const outboundFlightInfo = validateUserData<FlightInfo>(request.userData.outboundFlightInfo, 'outboundFlightInfo');
    const leg1FLightInfo = validateUserData<FlightInfo>(request.userData.leg1FLightInfo, 'leg1FLightInfo');
    const topFlightInfos = inboundFlightInfoList.slice(0, TOP_FLIGHTS_TO_COLLECT_LIMIT);

    const combineFlightInfoList = topFlightInfos.map((inboundFlightInfo: FlightInfo) =>
        combineOutboundInboundFlightInfo(outboundFlightInfo, inboundFlightInfo),
    );

    const resultPromises = combineFlightInfoList.map(async (combinedFlightInfo: FlightInfo) => {
        const finalCombinedFlightInfo = combineAlternativeRouteFlightInfo(leg1FLightInfo, combinedFlightInfo);
        return await Dataset.pushData({
            pattern: PATTERN.ALTERNATIVE_ROUTE,
            flightInfo: finalCombinedFlightInfo,
        });
    });

    await Promise.all(resultPromises);
});
