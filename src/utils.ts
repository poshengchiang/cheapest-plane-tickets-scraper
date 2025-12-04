import { log } from 'apify';
import type { PlaywrightCrawlingContext } from 'crawlee';

import { LABELS } from './constants.js';
import type {
    AlternativeRouteSearchInfo,
    DirectRouteSearchInfo,
    FlightData,
    FlightInfo,
    FlightResponseData,
    FlightSection,
} from './types.js';

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

/**
 * Type-safe parameters for creating requests with label-specific requirements
 * Each label requires specific searchInfo and flightInfo parameters
 */

// Initial outbound requests (no previous flight info needed)
interface DirectOutboundParams {
    label: typeof LABELS.DIRECT_OUTBOUND;
    searchInfo: DirectRouteSearchInfo;
}

interface AltLeg1OutboundParams {
    label: typeof LABELS.ALT_LEG1_OUTBOUND;
    searchInfo: AlternativeRouteSearchInfo;
}

// Continuation requests for inbound (requires outboundFlightInfo)
interface DirectInboundParams {
    label: typeof LABELS.DIRECT_INBOUND;
    searchInfo: DirectRouteSearchInfo;
    outboundFlightInfo: FlightInfo;
}

interface AltLeg1InboundParams {
    label: typeof LABELS.ALT_LEG1_INBOUND;
    searchInfo: AlternativeRouteSearchInfo;
    outboundFlightInfo: FlightInfo;
}

// Alternative route leg2 outbound (requires leg1FlightInfo)
interface AltLeg2OutboundParams {
    label: typeof LABELS.ALT_LEG2_OUTBOUND;
    searchInfo: AlternativeRouteSearchInfo;
    leg1FlightInfo: FlightInfo;
}

// Alternative route leg2 inbound (requires both outboundFlightInfo and leg1FlightInfo)
interface AltLeg2InboundParams {
    label: typeof LABELS.ALT_LEG2_INBOUND;
    searchInfo: AlternativeRouteSearchInfo;
    outboundFlightInfo: FlightInfo;
    leg1FlightInfo: FlightInfo;
}

/**
 * Union type for all possible request parameter combinations
 * TypeScript will enforce that the correct parameters are provided for each label
 */
export type CreateRequestParams =
    | DirectOutboundParams
    | DirectInboundParams
    | AltLeg1OutboundParams
    | AltLeg1InboundParams
    | AltLeg2OutboundParams
    | AltLeg2InboundParams;

/**
 * Universal factory function to create any route request
 * Determines URL and userData structure based on label
 */
export function createRequest(params: CreateRequestParams) {
    const { label, searchInfo } = params;

    // Determine which cities and whether we need productId/policyId
    let departureCityCode: string;
    let targetCityCode: string;
    let productId: string | undefined;
    let policyId: string | undefined;

    switch (label) {
        case LABELS.DIRECT_OUTBOUND:
            // TPE -> PRG (outbound)
            departureCityCode = searchInfo.departureCityCode;
            targetCityCode = searchInfo.targetCityCode;
            break;

        case LABELS.DIRECT_INBOUND:
            // PRG -> TPE (inbound, needs flight from outbound)
            departureCityCode = searchInfo.departureCityCode;
            targetCityCode = searchInfo.targetCityCode;
            productId = params.outboundFlightInfo.productId;
            policyId = params.outboundFlightInfo.policyId;
            break;

        case LABELS.ALT_LEG1_OUTBOUND:
            // TPE -> HKG (leg1 outbound to intermediate)
            departureCityCode = searchInfo.departureCityCode;
            targetCityCode = searchInfo.intermediateCityCode;
            break;

        case LABELS.ALT_LEG1_INBOUND:
            // HKG -> TPE (leg1 inbound from intermediate)
            departureCityCode = searchInfo.departureCityCode;
            targetCityCode = searchInfo.intermediateCityCode;
            productId = params.outboundFlightInfo.productId;
            policyId = params.outboundFlightInfo.policyId;
            break;

        case LABELS.ALT_LEG2_OUTBOUND:
            // HKG -> PRG (leg2 outbound from intermediate to target)
            departureCityCode = searchInfo.intermediateCityCode;
            targetCityCode = searchInfo.targetCityCode;
            break;

        case LABELS.ALT_LEG2_INBOUND:
            // PRG -> HKG (leg2 inbound from target to intermediate)
            departureCityCode = searchInfo.intermediateCityCode;
            targetCityCode = searchInfo.targetCityCode;
            productId = params.outboundFlightInfo.productId;
            policyId = params.outboundFlightInfo.policyId;
            break;

        default:
            // TypeScript will ensure this is never reached
            throw new Error(`Unknown label: ${label satisfies never}`);
    }

    // Create URL based on whether it's initial search or continuation
    const url =
        productId && policyId
            ? createInboundUrl({
                  departureCityCode,
                  targetCityCode,
                  departureDate: searchInfo.departureDate,
                  returnDate: searchInfo.returnDate,
                  productId,
                  policyId,
                  cabinClass: searchInfo.cabinClass,
                  quantity: searchInfo.quantity,
                  airlines: searchInfo.airlines,
              })
            : createOutBoundUrl({
                  departureCityCode,
                  targetCityCode,
                  departureDate: searchInfo.departureDate,
                  returnDate: searchInfo.returnDate,
                  cabinClass: searchInfo.cabinClass,
                  quantity: searchInfo.quantity,
                  airlines: searchInfo.airlines,
              });

    // Build userData - only include what's provided
    const userData: Record<string, unknown> = { searchInfo };

    if ('outboundFlightInfo' in params) {
        userData.outboundFlightInfo = params.outboundFlightInfo;
    }

    if ('leg1FlightInfo' in params) {
        userData.leg1FLightInfo = params.leg1FlightInfo;
    }

    return { url, label, userData };
}

export interface OutBoundParams {
    departureCityCode: string;
    targetCityCode: string;
    departureDate: string; // Departure date (YYYY-MM-DD format)
    returnDate: string; // Return date (YYYY-MM-DD format)
    cabinClass?: string; // Cabin class (default: 'y' for economy)
    quantity?: number; // Number of passengers (default: 1)
    airlines?: string[]; // Preferred airlines (default: empty array)
}

export function createOutBoundUrl(params: OutBoundParams): string {
    const {
        departureCityCode,
        targetCityCode,
        departureDate,
        returnDate,
        cabinClass = 'y',
        quantity = 1,
        airlines = [],
    } = params;

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

    if (airlines.length > 0) {
        searchParams.append('airline', airlines.join(','));
    }

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
    airlines?: string[]; // Preferred airlines (default: empty array)
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
        airlines = [],
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

    if (airlines.length > 0) {
        searchParams.append('airline', airlines.join(','));
    }

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

            const departureCityName = flightData.journeyList[0].transSectionList[0].departPoint.cityName;
            const departureCityCode = flightData.journeyList[0].transSectionList[0].departPoint.cityCode;
            const targetCityName = flightData.journeyList[0].transSectionList[totalFlights - 1].arrivePoint.cityName;
            const targetCityCode = flightData.journeyList[0].transSectionList[totalFlights - 1].arrivePoint.cityCode;
            const { policyId } = flightData.policies[0];

            const flights = flightData.journeyList[0].transSectionList.map((flightSection: FlightSection) => {
                return {
                    departureCityCode: flightSection.departPoint.cityCode,
                    departureAirport: flightSection.departPoint.airportCode,
                    departureTime: flightSection.departDateTime,
                    arrivalCityCode: flightSection.arrivePoint.cityCode,
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
                departureCityName,
                departureCityCode,
                targetCityName,
                targetCityCode,
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
        departureCityName: outbound.departureCityName,
        departureCityCode: outbound.departureCityCode,
        targetCityName: outbound.targetCityName,
        targetCityCode: outbound.targetCityCode,
        totalFlights: inbound.totalFlights + outbound.totalFlights,
        productId: inbound.productId,
        policyId: inbound.policyId,
        flights: [...outbound.flights, ...inbound.flights],
    };
}

export function combineAlternativeRouteFlightInfo(leg1FlightInfo: FlightInfo, leg2FlightInfo: FlightInfo): FlightInfo {
    // Find the index where leg1 arrives at the intermediate city
    const intermediateArrivalIndex = leg1FlightInfo.flights.findIndex(
        (flight) => flight.arrivalCityCode === leg1FlightInfo.targetCityCode,
    );

    if (intermediateArrivalIndex === -1) {
        log.error('Could not find intermediate city in leg1 flights', {
            intermediateCityCode: leg1FlightInfo.targetCityCode,
            leg1Flights: leg1FlightInfo.flights.map((f) => `${f.departureAirport}->${f.arrivalAirport}`),
        });
        throw new Error(`Intermediate city ${leg1FlightInfo.targetCityCode} not found in leg1 flights`);
    }

    // Split leg1 flights: before intermediate city (inclusive) and after
    const leg1BeforeIntermediate = leg1FlightInfo.flights.slice(0, intermediateArrivalIndex + 1);
    const leg1AfterIntermediate = leg1FlightInfo.flights.slice(intermediateArrivalIndex + 1);

    // Combine: leg1 before -> leg2 all flights -> leg1 after
    const combinedFlights = [...leg1BeforeIntermediate, ...leg2FlightInfo.flights, ...leg1AfterIntermediate];

    return {
        totalPrice: leg1FlightInfo.totalPrice + leg2FlightInfo.totalPrice,
        totalTimeMinutes: leg1FlightInfo.totalTimeMinutes + leg2FlightInfo.totalTimeMinutes,
        departureCityName: leg1FlightInfo.departureCityName,
        departureCityCode: leg1FlightInfo.departureCityCode,
        targetCityName: leg2FlightInfo.targetCityName,
        targetCityCode: leg2FlightInfo.targetCityCode,
        totalFlights: combinedFlights.length,
        productId: `${leg1FlightInfo.productId}+${leg2FlightInfo.productId}`,
        policyId: `${leg1FlightInfo.policyId}+${leg2FlightInfo.policyId}`,
        flights: combinedFlights,
    };
}
