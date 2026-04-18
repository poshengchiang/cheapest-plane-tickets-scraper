import type { DirectRouteSearchInfo, Input, TimePeriod } from '../../types.js';
import { directPipeline } from './pipeline.js';

export const DirectRouteModule = {
    pipelineName: 'direct' as const,
    pipeline: directPipeline,
    createSearchInfos: (input: Input, periods: TimePeriod[]): DirectRouteSearchInfo[] =>
        periods.map((period) => ({
            routeType: 'direct' as const,
            departureCityCode: input.mainDepartureCity,
            targetCityCode: input.targetCity,
            departureDate: period.outboundDate,
            returnDate: period.inboundDate,
            cabinClass: input.cabinClass,
            quantity: input.numberOfPeople,
            airlines: input.airlines ?? [],
        })),
};
