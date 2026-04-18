import { PATTERN, TOP_FLIGHTS_TO_COLLECT_LIMIT } from '../../constants.js';
import { combineOutboundInboundFlightInfo } from '../../services/flight-data.js';
import type { PipelineStep } from '../../types.js';

export const directPipeline: PipelineStep[] = [
    {
        name: 'outbound',
        handler: 'outbound',
        fanOut: TOP_FLIGHTS_TO_COLLECT_LIMIT,
        role: 'fan-out',
        getCities: (info) => ({ departureCityCode: info.departureCityCode, targetCityCode: info.targetCityCode }),
    } ,
    {
        name: 'inbound',
        handler: 'inbound',
        fanOut: TOP_FLIGHTS_TO_COLLECT_LIMIT,
        role: 'save',
        getCities: (info) => ({ departureCityCode: info.departureCityCode, targetCityCode: info.targetCityCode }),
        execute: ({ flight, lastFlight, searchInfo }) => {
            const combined = combineOutboundInboundFlightInfo(lastFlight!, flight);
            return {
                type: 'save',
                results: [{
                    pattern: PATTERN.DIRECT_ROUTE,
                    totalPrice: combined.totalPrice,
                    mainDepartureCity: combined.departureCityCode,
                    intermediateCity: null,
                    targetCity: combined.targetCityCode,
                    departureDate: searchInfo.departureDate,
                    returnDate: searchInfo.returnDate,
                    totalTimeMinutes: combined.totalTimeMinutes,
                    flightInfo: combined,
                }],
            };
        },
    } ,
];
