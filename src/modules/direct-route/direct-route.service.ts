import { Injectable } from '@nestjs/common';

import { PATTERN, TOP_FLIGHTS_TO_COLLECT_LIMIT } from '../../constants.js';
import { FlightDataService } from '../../services/flight-data.service.js';
import type { DirectRouteSearchInfo, Input, PipelineStep, TimePeriod } from '../../types.js';

@Injectable()
export class DirectRouteService {
    readonly pipelineName = 'direct' as const;
    readonly pipeline: PipelineStep[];

    constructor(private readonly flightDataService: FlightDataService) {
        this.pipeline = [
            {
                name: 'outbound',
                handler: 'outbound',
                fanOut: TOP_FLIGHTS_TO_COLLECT_LIMIT,
                role: 'fan-out',
                getCities: (info) => ({ departureCityCode: info.departureCityCode, targetCityCode: info.targetCityCode }),
            },
            {
                name: 'inbound',
                handler: 'inbound',
                fanOut: TOP_FLIGHTS_TO_COLLECT_LIMIT,
                role: 'save',
                getCities: (info) => ({ departureCityCode: info.departureCityCode, targetCityCode: info.targetCityCode }),
                execute: ({ flight, lastFlight, searchInfo }) => {
                    const combined = this.flightDataService.combineOutboundInboundFlightInfo(lastFlight, flight);
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
    }

    createSearchInfos(input: Input, periods: TimePeriod[]): DirectRouteSearchInfo[] {
        return periods.map((period) => ({
            routeType: 'direct' as const,
            departureCityCode: input.mainDepartureCity,
            targetCityCode: input.targetCity,
            departureDate: period.outboundDate,
            returnDate: period.inboundDate,
            cabinClass: input.cabinClass,
            quantity: input.numberOfPeople,
            airlines: input.airlines ?? [],
        }));
    }
}
