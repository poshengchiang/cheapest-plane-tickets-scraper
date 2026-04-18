import { combineAlternativeRouteFlightInfo, combineOutboundInboundFlightInfo } from './combiners.js';
import { PATTERN, TOP_FLIGHTS_TO_COLLECT_LIMIT } from './constants.js';
import type { AlternativeRouteSearchInfo, FlightInfo, PipelineName, RouteResult, SearchInfo } from './types.js';

export type StepRole = 'fan-out' | 'combine' | 'save' | 'merge-save';

export type StepResult =
    | { type: 'advance'; combinedFlight: FlightInfo }
    | { type: 'save'; results: RouteResult[] };

export interface StepExecuteParams {
    flight: FlightInfo;
    lastFlight: FlightInfo | undefined;
    combinedFlight: FlightInfo | undefined;
    searchInfo: SearchInfo;
}

interface BaseStep {
    name: string;
    fanOut: number;
    role: StepRole;
    getCities: (searchInfo: SearchInfo) => { departureCityCode: string; targetCityCode: string };
}

export interface SSEStep extends BaseStep {
    responseType: 'sse';
}

export interface FlightStep extends BaseStep {
    responseType: 'flight';
    execute: (params: StepExecuteParams) => StepResult;
}

export type PipelineStep = SSEStep | FlightStep;

const directPipeline: PipelineStep[] = [
    {
        name: 'outbound',
        responseType: 'sse',
        fanOut: TOP_FLIGHTS_TO_COLLECT_LIMIT,
        role: 'fan-out',
        getCities: (info) => ({ departureCityCode: info.departureCityCode, targetCityCode: info.targetCityCode }),
    },
    {
        name: 'inbound',
        responseType: 'flight',
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
    },
];

const alternativePipeline: PipelineStep[] = [
    {
        name: 'outbound-leg1',
        responseType: 'sse',
        fanOut: TOP_FLIGHTS_TO_COLLECT_LIMIT,
        role: 'fan-out',
        getCities: (info) => ({
            departureCityCode: info.departureCityCode,
            targetCityCode: (info as AlternativeRouteSearchInfo).intermediateCityCode,
        }),
    },
    {
        name: 'outbound-leg2',
        responseType: 'flight',
        fanOut: 1,
        role: 'combine',
        getCities: (info) => ({
            departureCityCode: info.departureCityCode,
            targetCityCode: (info as AlternativeRouteSearchInfo).intermediateCityCode,
        }),
        execute: ({ flight, lastFlight }) => {
            const combined = combineOutboundInboundFlightInfo(lastFlight!, flight);
            return { type: 'advance', combinedFlight: combined };
        },
    },
    {
        name: 'inbound-leg1',
        responseType: 'sse',
        fanOut: TOP_FLIGHTS_TO_COLLECT_LIMIT,
        role: 'fan-out',
        getCities: (info) => ({
            departureCityCode: (info as AlternativeRouteSearchInfo).intermediateCityCode,
            targetCityCode: info.targetCityCode,
        }),
    },
    {
        name: 'inbound-leg2',
        responseType: 'flight',
        fanOut: TOP_FLIGHTS_TO_COLLECT_LIMIT,
        role: 'merge-save',
        getCities: (info) => ({
            departureCityCode: (info as AlternativeRouteSearchInfo).intermediateCityCode,
            targetCityCode: info.targetCityCode,
        }),
        execute: ({ flight, lastFlight, combinedFlight, searchInfo }) => {
            const legCombined = combineOutboundInboundFlightInfo(lastFlight!, flight);
            const final = combineAlternativeRouteFlightInfo(combinedFlight!, legCombined);
            const altInfo = searchInfo as AlternativeRouteSearchInfo;
            return {
                type: 'save',
                results: [{
                    pattern: PATTERN.ALTERNATIVE_ROUTE,
                    totalPrice: final.totalPrice,
                    mainDepartureCity: final.departureCityCode,
                    intermediateCity: altInfo.intermediateCityCode,
                    targetCity: final.targetCityCode,
                    departureDate: searchInfo.departureDate,
                    returnDate: searchInfo.returnDate,
                    totalTimeMinutes: final.totalTimeMinutes,
                    flightInfo: final,
                }],
            };
        },
    },
];

export const PIPELINES: Record<PipelineName, PipelineStep[]> = {
    direct: directPipeline,
    alternative: alternativePipeline,
};
