import { log } from 'apify';
import type { PlaywrightCrawlingContext } from 'crawlee';

import type { FlightData, FlightInfo, FlightResponseData, FlightSection } from './types.js';

/**
 * Wait for data to appear in request.userData with periodic checks
 * @param request - Crawlee request object
 * @param page - Playwright page object
 * @param userDataKey - Key to check in request.userData
 * @param maxWaitTime - Maximum time to wait in milliseconds (default: 30000)
 * @param checkInterval - Interval between checks in milliseconds (default: 3000)
 * @returns The data when found, or null if timeout
 */
export async function waitForUserData<T>(
    request: PlaywrightCrawlingContext['request'],
    page: PlaywrightCrawlingContext['page'],
    userDataKey: string,
    maxWaitTime = 30000,
    checkInterval = 3000,
): Promise<T | null> {
    let data = request.userData[userDataKey] as T | undefined;

    if (!data) {
        log.warning(`No ${userDataKey} found in request.userData, waiting...`);
        const maxAttempts = maxWaitTime / checkInterval;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            await page.waitForTimeout(checkInterval);
            data = request.userData[userDataKey] as T | undefined;

            if (data) {
                log.info(`${userDataKey} found after ${(attempt * checkInterval) / 1000} seconds`);
                return data;
            }

            log.warning(`Attempt ${attempt}/${maxAttempts}: Still waiting for ${userDataKey}...`);
        }
    }

    return data ?? null;
}

export interface OutBoundParams {
    departureCityCode: string;
    targetCityCode: string;
    departureDate: string; // Departure date (YYYY-MM-DD format)
    returnDate: string; // Return date (YYYY-MM-DD format)
    cabinClass?: string; // Cabin class (default: 'y' for economy)
    quantity?: number; // Number of passengers (default: 1)
}

export function createOutBoundUrl(params: OutBoundParams): string {
    const { departureCityCode, targetCityCode, departureDate, returnDate, cabinClass = 'y', quantity = 1 } = params;

    const baseUrl = 'https://tw.trip.com/flights/showfarefirst';
    const searchParams = new URLSearchParams({
        dcity: departureCityCode,
        acity: targetCityCode,
        ddate: departureDate,
        rdate: returnDate,
        triptype: 'rt', // Round trip
        class: cabinClass,
        lowpricesource: 'searchform',
        quantity: String(quantity),
        searchboxarg: 't',
        nonstoponly: 'off',
        sort: 'direct',
    });

    return `${baseUrl}?${searchParams.toString()}`;
}

export interface InBoundParams {
    departureCityCode: string; // Departure city code (e.g., 'tpe')
    targetCityCode: string; // Arrival city code (e.g., 'prg')
    departureDate: string; // Departure date (YYYY-MM-DD format)
    returnDate: string; // Return date (YYYY-MM-DD format)
    // dcityName: string; // Departure city name (e.g., 'Taipei'), but seems not required
    // acityName: string; // Arrival city name (e.g., 'Prague'), but seems not required
    productId: string; // Product ID from first flight page (criteriaToken)
    policyId: string; // Policy ID from first flight page (shoppingid and groupKey)
    locale?: string; // Locale (default: 'zh-TW')
    curr?: string; // Currency (default: 'TWD')
    cabinClass?: string; // Cabin class (default: 'Y')
    quantity?: number; // Number of passengers (default: 1)
    childqty?: number; // Number of children (default: 0)
    babyqty?: number; // Number of babies (default: 0)
}

export function createInboundUrl(params: InBoundParams): string {
    const {
        departureCityCode,
        targetCityCode,
        departureDate,
        returnDate,
        productId,
        policyId,
        locale = 'zh-TW',
        curr = 'TWD',
        cabinClass = 'Y',
        quantity = 1,
        childqty = 0,
        babyqty = 0,
    } = params;

    const baseUrl = 'https://tw.trip.com/flights/ShowFareNext';
    const searchParams = new URLSearchParams({
        pagesource: 'list',
        triptype: 'RT',
        class: cabinClass,
        quantity: String(quantity),
        childqty: String(childqty),
        babyqty: String(babyqty),
        jumptype: 'GoToNextJournay',
        dcity: departureCityCode,
        acity: targetCityCode,
        ddate: departureDate,
        rdate: returnDate,
        currentseqno: '2',
        criteriaToken: productId,
        shoppingid: policyId,
        groupKey: policyId,
        locale,
        curr,
        sort: 'direct',
    });

    return `${baseUrl}?${searchParams.toString()}`;
}

export function extractFlightData(ResponseData: FlightResponseData): FlightInfo[] | null {
    try {
        const { recordCount } = ResponseData.basicInfo;
        if (recordCount <= 1) {
            log.warning('No outbound flights found in response', { recordCount });
        }

        const flightsData = ResponseData.itineraryList || [];
        const { productId } = ResponseData.basicInfo;

        const flightInfos: FlightInfo[] = flightsData.map((flightData: FlightData) => {
            const { totalPrice } = flightData.policies[0].price;
            const totalFlights = flightData.journeyList[0].transSectionList.length;
            const totalTimeMinutes = flightData.journeyList[0].duration;

            const departureCity = flightData.journeyList[0].transSectionList[0].departPoint.cityName;
            const targetCity = flightData.journeyList[0].transSectionList[totalFlights - 1].arrivePoint.cityName;

            const { policyId } = flightData.policies[0];

            const flights = flightData.journeyList[0].transSectionList.map((flightSection: FlightSection) => {
                return {
                    departureAirport: flightSection.departPoint.airportCode,
                    departureTime: flightSection.departDateTime,
                    arrivalAirport: flightSection.arrivePoint.airportCode,
                    arrivalTime: flightSection.arriveDateTime,
                    flightSegment: {
                        airline: flightSection.flightInfo.airlineCode,
                        flightNumber: flightSection.flightInfo.flightNo,
                    },
                    durationTimeMinutes: flightSection.duration,
                };
            });

            return {
                totalPrice,
                totalTimeMinutes,
                departureCity,
                targetCity,
                totalFlights,
                productId,
                policyId,
                flights,
            };
        });

        return flightInfos;
    } catch (error) {
        log.error('Failed to extract flight data', { error, ResponseData });
        return null;
    }
}

export function combineOutboundInboundFlightInfo(outbound: FlightInfo, inbound: FlightInfo): FlightInfo {
    return {
        totalPrice: inbound.totalPrice,
        totalTimeMinutes: inbound.totalTimeMinutes + outbound.totalTimeMinutes,
        departureCity: outbound.departureCity,
        targetCity: outbound.targetCity,
        totalFlights: inbound.totalFlights + outbound.totalFlights,
        productId: inbound.productId,
        policyId: inbound.policyId,
        flights: [...outbound.flights, ...inbound.flights],
    };
}
