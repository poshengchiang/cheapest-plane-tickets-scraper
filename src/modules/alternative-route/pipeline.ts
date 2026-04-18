import { PATTERN, TOP_FLIGHTS_TO_COLLECT_LIMIT } from '../../constants.js';
import { combineOutboundInboundFlightInfo } from '../../services/flight-data.js';
import type { AlternativeRouteSearchInfo, PipelineStep, SearchInfo } from '../../types.js';
import { combineAlternativeRouteFlightInfo } from './combiners.js';

function asAlternativeInfo(info: SearchInfo): AlternativeRouteSearchInfo {
    if (info.routeType !== 'alternative') throw new Error('Expected alternative route search info');
    return info;
}

export const alternativePipeline: PipelineStep[] = [
    {
        name: 'booking1-go',
        handler: 'outbound',
        fanOut: TOP_FLIGHTS_TO_COLLECT_LIMIT,
        role: 'fan-out',
        getCities: (info) => {
            const alt = asAlternativeInfo(info);
            return { departureCityCode: alt.departureCityCode, targetCityCode: alt.intermediateCityCode };
        },
    },
    {
        name: 'booking1-return',
        handler: 'inbound',
        fanOut: 1,
        role: 'combine',
        getCities: (info) => {
            const alt = asAlternativeInfo(info);
            return { departureCityCode: alt.departureCityCode, targetCityCode: alt.intermediateCityCode };
        },
        execute: ({ flight, lastFlight }) => {
            const combined = combineOutboundInboundFlightInfo(lastFlight!, flight);
            return { type: 'advance', combinedFlight: combined };
        },
    },
    {
        name: 'booking2-go',
        handler: 'outbound',
        fanOut: TOP_FLIGHTS_TO_COLLECT_LIMIT,
        role: 'fan-out',
        getCities: (info) => {
            const alt = asAlternativeInfo(info);
            return { departureCityCode: alt.intermediateCityCode, targetCityCode: alt.targetCityCode };
        },
    },
    {
        name: 'booking2-return',
        handler: 'inbound',
        fanOut: TOP_FLIGHTS_TO_COLLECT_LIMIT,
        role: 'merge-save',
        getCities: (info) => {
            const alt = asAlternativeInfo(info);
            return { departureCityCode: alt.intermediateCityCode, targetCityCode: alt.targetCityCode };
        },
        execute: ({ flight, lastFlight, combinedFlight, searchInfo }) => {
            const alt = asAlternativeInfo(searchInfo);
            const legCombined = combineOutboundInboundFlightInfo(lastFlight!, flight);
            const final = combineAlternativeRouteFlightInfo(combinedFlight!, legCombined);
            return {
                type: 'save',
                results: [{
                    pattern: PATTERN.ALTERNATIVE_ROUTE,
                    totalPrice: final.totalPrice,
                    mainDepartureCity: final.departureCityCode,
                    intermediateCity: alt.intermediateCityCode,
                    targetCity: final.targetCityCode,
                    departureDate: alt.departureDate,
                    returnDate: alt.returnDate,
                    totalTimeMinutes: final.totalTimeMinutes,
                    flightInfo: final,
                }],
            };
        },
    },
];
