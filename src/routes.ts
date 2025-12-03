import { createPlaywrightRouter, Dataset } from 'crawlee';

import { LABELS, PATTERN } from './constants.js';
import type { DirectRouteSearchInfo, FlightInfo } from './types.js';
import { createInboundUrl } from './utils.js';

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
        return;
    }

    if (request.userData.pattern === PATTERN.DIRECT_ROUTE) {
        const searchInfo = request.userData.searchInfo as DirectRouteSearchInfo;

        for (const flightInfo of outboundFlightInfoList) {
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

router.addHandler(LABELS.IN_BOUND, async ({ request, page, log }) => {
    const title = await page.title();
    log.info(`${title}`, { url: request.loadedUrl });

    await Dataset.pushData({
        url: request.loadedUrl,
        title,
    });
});
