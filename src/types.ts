export interface TimePeriod {
    outboundDate: string; // YYYY-MM-DD format
    inboundDate: string; // YYYY-MM-DD format
}

/**
 * Input parameters for the Actor
 */
export interface Input {
    mainDepartureCity: string; // Primary departure city/airport code (e.g., 'TPE')
    targetCity: string; // Final destination city/airport code (e.g., 'NRT')
    cabinClass: 'Economy' | 'Business' | 'First'; // Cabin class
    numberOfPeople: number; // Number of passengers (1-9)
    timePeriods: TimePeriod[]; // Travel date ranges

    alternativeDepartureCities?: string[]; // Intermediate cities for multi-leg routes
    airlines?: string[]; // Filter by specific airlines (applies to ALL legs)
    targetLowestPrice?: boolean; // Sort by lowest price (default: true)
    transferTimeHours?: number; // Minimum transfer time in hours (default: 3)
    adcBufferHours?: number; // Buffer for ADC searches in hours (default: 24)
    maxRequestsPerCrawl?: number; // Request limit (default: 1000)
}

/**
 * Flight segment information
 */
export interface FlightSegment {
    airline: string; // e.g., "EVA Air"
    flightNumber: string; // e.g., "BR189"
}

/**
 * Individual flight leg information
 */
export interface FlightLeg {
    leg: string; // e.g., "outbound", "inbound", "MDC_to_ADC", etc.
    departureAirport: string;
    departureTime: string; // ISO 8601 format
    arrivalAirport: string;
    arrivalTime: string; // ISO 8601 format
    flightSegments: FlightSegment[];
    durationTimeHours: number;
}

/**
 * Base interface for route results
 */
interface BaseRoute {
    totalPrice: number;
    totalTimeHours: number;
    timePeriod: {
        outboundDate: string; // Actual selected date
        inboundDate: string; // Actual selected date
    };
}

/**
 * Direct route result (MDC → TC)
 */
export interface DirectRoute extends BaseRoute {
    routeType: 'DIRECT';
    departureCity: string; // MDC
    targetCity: string; // TC
    totalFlights: 2; // outbound + inbound
    flights: FlightLeg[]; // 2 legs: outbound, inbound
}

/**
 * Alternative route result via intermediate city (MDC → ADC → TC)
 */
export interface AlternativeRoute extends BaseRoute {
    routeType: 'ALTERNATIVE';
    departureCity: string; // MDC
    intermediateCity: string; // ADC
    targetCity: string; // TC
    totalFlights: 4; // MDC→ADC, ADC→TC, TC→ADC, ADC→MDC
    flights: FlightLeg[]; // 4 legs: MDC_to_ADC, ADC_to_TC, TC_to_ADC, ADC_to_MDC
}

/**
 * Union type for all route results
 */
export type RouteResult = DirectRoute | AlternativeRoute;
