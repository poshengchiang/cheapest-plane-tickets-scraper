import type { AlternativeRouteSearchInfo, Input, TimePeriod } from '../../types.js';
import { alternativePipeline } from './pipeline.js';

export const AlternativeRouteModule = {
    pipelineName: 'alternative' as const,
    pipeline: alternativePipeline,
    createSearchInfos: (input: Input, periods: TimePeriod[]): AlternativeRouteSearchInfo[] =>
        periods.flatMap((period) =>
            (input.alternativeDepartureCities ?? []).map((intermediateCityCode) => ({
                routeType: 'alternative' as const,
                departureCityCode: input.mainDepartureCity,
                intermediateCityCode,
                targetCityCode: input.targetCity,
                departureDate: period.outboundDate,
                returnDate: period.inboundDate,
                cabinClass: input.cabinClass,
                quantity: input.numberOfPeople,
                airlines: input.airlines ?? [],
            })),
        ),
};
