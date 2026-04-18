import { log } from 'apify';

import type { FlightInfo } from '../../types.js';

export function combineAlternativeRouteFlightInfo(leg1FlightInfo: FlightInfo, leg2FlightInfo: FlightInfo): FlightInfo {
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

    const leg1BeforeIntermediate = leg1FlightInfo.flights.slice(0, intermediateArrivalIndex + 1);
    const leg1AfterIntermediate = leg1FlightInfo.flights.slice(intermediateArrivalIndex + 1);
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
