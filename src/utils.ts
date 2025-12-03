import { log } from 'apify';

import { LABELS, PATTERN } from './constants.js';
import type {
    AlternativeRouteRequest,
    DirectRouteRequest,
    FlightData,
    FlightInfo,
    FlightResponseData,
    FlightSection,
} from './types.js';

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

export function extractFlightData(sseResponseData: FlightResponseData): FlightInfo[] | null {
    try {
        const { recordCount } = sseResponseData.basicInfo;
        if (recordCount <= 1) {
            log.warning('No outbound flights found in SSE response', { recordCount });
        }

        const flightsData = sseResponseData.itineraryList || [];
        const { productId } = sseResponseData.basicInfo;

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
        log.error('Failed to extract flight data', { error, sseResponseData });
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

export function createRouteRequest(
    pattern: PATTERN,
    departureCityCode: string,
    targetCityCode: string,
    departureDate: string,
    returnDate: string,
    numberOfPeople: number,
    cabinClass: string,
    intermediateCityCode?: string,
): DirectRouteRequest | AlternativeRouteRequest {
    const url = createOutBoundUrl({
        departureCityCode,
        targetCityCode,
        departureDate,
        returnDate,
        quantity: numberOfPeople,
    });

    if (pattern === PATTERN.DIRECT_ROUTE) {
        return {
            url,
            label: LABELS.OUT_BOUND,
            userData: {
                pattern: PATTERN.DIRECT_ROUTE,
                searchInfo: {
                    departureCityCode,
                    targetCityCode,
                    departureDate,
                    returnDate,
                    cabinClass,
                    quantity: numberOfPeople,
                },
            },
        };
    }

    if (pattern === PATTERN.ALTERNATIVE_ROUTE) {
        return {
            url,
            label: LABELS.OUT_BOUND,
            userData: {
                pattern: PATTERN.ALTERNATIVE_ROUTE,
                searchInfo: {
                    departureCityCode,
                    intermediateCityCode,
                    targetCityCode,
                    departureDate,
                    returnDate,
                    cabinClass,
                    quantity: numberOfPeople,
                },
            },
        };
    }
    throw new Error(`Unsupported pattern: ${pattern}`);
}
