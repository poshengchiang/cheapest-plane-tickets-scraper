import { TOP_FLIGHTS_TO_COLLECT_LIMIT } from './constants.js';
import type { AlternativeRouteSearchInfo, PipelineName, SearchInfo } from './types.js';

export type StepRole = 'fan-out' | 'combine' | 'save' | 'merge-save';

export interface PipelineStep {
    name: string;
    responseType: 'sse' | 'flight';
    fanOut: number;
    role: StepRole;
    getCities: (searchInfo: SearchInfo) => { departureCityCode: string; targetCityCode: string };
}

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
    },
];

export const PIPELINES: Record<PipelineName, PipelineStep[]> = {
    direct: directPipeline,
    alternative: alternativePipeline,
};
