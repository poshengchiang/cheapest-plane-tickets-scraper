import { createPlaywrightRouter, Dataset } from 'crawlee';

import { LABELS, PATTERN, TOP_FLIGHTS_TO_COLLECT_LIMIT } from './constants.js';
import type { DirectRouteSearchInfo, FlightInfo } from './types.js';
import { combineOutboundInboundFlightInfo, createInboundUrl } from './utils.js';

export const router = createPlaywrightRouter();

router.addHandler(LABELS.OUT_BOUND, async ({ request, log, page, crawler }) => {
    let outboundFlightInfoList;
    outboundFlightInfoList = request.userData.outboundFlightInfoList as FlightInfo[] | undefined;

    if (!outboundFlightInfoList) {
        log.warning('No outbound flight data found in request.userData');
        await page.waitForTimeout(3000);
        outboundFlightInfoList = request.userData.outboundFlightInfoList as FlightInfo[] | undefined;
    }

    if (!outboundFlightInfoList) {
        log.error('Outbound flight data is still missing after wait. Skipping dataset push.');
        throw new Error('Missing outbound flight data');
    }

    if (request.userData.pattern === PATTERN.DIRECT_ROUTE) {
        const searchInfo = request.userData.searchInfo as DirectRouteSearchInfo;
        const topFlightInfos = outboundFlightInfoList.slice(0, TOP_FLIGHTS_TO_COLLECT_LIMIT);

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
                    label: LABELS.IN_BOUND,
                    userData: {
                        outboundFlightInfo: flightInfo,
                        searchInfo,
                        pattern: request.userData.pattern,
                    },
                },
            ]);
        }
    }
});

router.addHandler(LABELS.IN_BOUND, async ({ request, log }) => {
    const outboundFlightInfo = request.userData.outboundFlightInfo as FlightInfo;
    const inboundFlightInfoList = request.userData.inboundFlightInfoList as FlightInfo[] | undefined;

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
});
