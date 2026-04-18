import { log } from 'apify';

import type { FlightData, FlightInfo, FlightResponseData, FlightSection } from '../types.js';

export function extractFlightData(responseData: FlightResponseData): FlightInfo[] | null {
    try {
        const { recordCount } = responseData.basicInfo;
        if (recordCount <= 1) {
            log.warning('No outbound flights found in response', { recordCount });
        }

        const flightsData = responseData.itineraryList || [];
        const { productId } = responseData.basicInfo;

        return flightsData.map((flightData: FlightData) => {
            const { totalPrice } = flightData.policies[0].price;
            const totalFlights = flightData.journeyList[0].transSectionList.length;
            const totalTimeMinutes = flightData.journeyList[0].duration;
            const departureCityName = flightData.journeyList[0].transSectionList[0].departPoint.cityName;
            const departureCityCode = flightData.journeyList[0].transSectionList[0].departPoint.cityCode;
            const targetCityName = flightData.journeyList[0].transSectionList[totalFlights - 1].arrivePoint.cityName;
            const targetCityCode = flightData.journeyList[0].transSectionList[totalFlights - 1].arrivePoint.cityCode;
            const { policyId } = flightData.policies[0];

            const flights = flightData.journeyList[0].transSectionList.map((flightSection: FlightSection) => ({
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
            }));

            return {
                totalPrice, totalTimeMinutes,
                departureCityName, departureCityCode,
                targetCityName, targetCityCode,
                totalFlights, productId, policyId, flights,
            };
        });
    } catch (error) {
        log.error('Failed to extract flight data', { error, responseData });
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
