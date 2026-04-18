import { log } from 'apify';

import { LABELS } from './constants.js';
import { PIPELINES } from './pipeline.js';
import type {
    FlightData,
    FlightInfo,
    FlightResponseData,
    FlightSection,
    PipelineUserData,
} from './types.js';

export function createPipelineRequest(userData: PipelineUserData) {
    const step = PIPELINES[userData.pipelineName][userData.stepIndex];
    const cities = step.getCities(userData.searchInfo);
    const { searchInfo } = userData;

    const label = step.responseType === 'sse' ? LABELS.SEARCH_OUTBOUND : LABELS.SEARCH_INBOUND;

    const url =
        step.responseType === 'sse'
            ? createOutBoundUrl({
                  ...cities,
                  departureDate: searchInfo.departureDate,
                  returnDate: searchInfo.returnDate,
                  cabinClass: searchInfo.cabinClass,
                  quantity: searchInfo.quantity,
                  airlines: searchInfo.airlines,
              })
            : createInboundUrl({
                  ...cities,
                  departureDate: searchInfo.departureDate,
                  returnDate: searchInfo.returnDate,
                  productId: userData.lastFlight!.productId,
                  policyId: userData.lastFlight!.policyId,
                  cabinClass: searchInfo.cabinClass,
                  quantity: searchInfo.quantity,
                  airlines: searchInfo.airlines,
              });

    return { url, label, userData };
}

export interface OutBoundParams {
    departureCityCode: string;
    targetCityCode: string;
    departureDate: string;
    returnDate: string;
    cabinClass?: string;
    quantity?: number;
    airlines?: string[];
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
        triptype: 'rt',
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
    departureCityCode: string;
    targetCityCode: string;
    departureDate: string;
    returnDate: string;
    productId: string;
    policyId: string;
    locale?: string;
    curr?: string;
    cabinClass?: string;
    quantity?: number;
    childqty?: number;
    babyqty?: number;
    airlines?: string[];
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


