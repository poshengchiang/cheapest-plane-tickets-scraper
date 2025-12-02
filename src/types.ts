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
    departureAirport: string;
    departureTime: string; // ISO 8601 format
    arrivalAirport: string;
    arrivalTime: string; // ISO 8601 format
    flightSegment: FlightSegment;
    durationTimeMinutes: number;
}

export interface FlightInfo {
    totalPrice: number;
    totalTimeMinutes: number;
    departureCity: string;
    targetCity: string;
    totalFlights: number;
    productId: string;
    policyId: string;
    flights: FlightLeg[];
}

export interface RouteResult {
    pattern: 'DIRECT_ROUTE' | 'ALTERNATIVE_ROUTE';
    flightInfo: FlightInfo;
    timePeriod: {
        outboundDate: string; // Actual selected date
        inboundDate: string; // Actual selected date
    };
}
