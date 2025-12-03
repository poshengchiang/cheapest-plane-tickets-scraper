import type { ALTERNATIVE_ROUTE_STEPS, LABELS, PATTERN } from './constants.js';

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
    cabinClass: 'Y' | 'C' | 'F'; // Cabin class
    numberOfPeople: number; // Number of passengers (1-9)
    timePeriods: TimePeriod[]; // Travel date ranges

    alternativeDepartureCities?: string[]; // Intermediate cities for multi-leg routes
    airlines?: string[]; // Filter by specific airlines (applies to ALL legs)
    targetLowestPrice?: boolean; // Sort by lowest price (default: true)
    transferTimeHours?: number; // Minimum transfer time in hours (default: 3)
    adcBufferHours?: number; // Buffer for ADC searches in hours (default: 24)
    maxRequestsPerCrawl?: number; // Request limit (default: 1000)
}

export interface DirectRouteSearchInfo {
    departureCityCode: string;
    targetCityCode: string;
    departureDate: string; // YYYY-MM-DD format
    returnDate: string; // YYYY-MM-DD format
    cabinClass: string; // 'Y' for Economy, 'C' for Business, 'F' for First
    quantity: number; // Number of passengers
}

export interface DirectRouteRequest {
    url: string;
    label: LABELS;
    userData: {
        pattern: PATTERN;
        searchInfo: DirectRouteSearchInfo;
    };
}

export interface AlternativeRouteSearchInfo extends DirectRouteSearchInfo {
    intermediateCityCode: string;
    step: ALTERNATIVE_ROUTE_STEPS;
}

export interface AlternativeRouteRequest {
    url: string;
    label: LABELS;
    userData: {
        pattern: PATTERN;
        searchInfo: AlternativeRouteSearchInfo;
    };
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
    pattern: PATTERN;
    flightInfo: FlightInfo;
    timePeriod: {
        outboundDate: string; // Actual selected date
        inboundDate: string; // Actual selected date
    };
}

/**
 * Flights http response structure
 */

// Response data structures
interface FlightPoint {
    cityName: string;
    airportCode: string;
}

export interface FlightSection {
    departPoint: FlightPoint;
    arrivePoint: FlightPoint;
    departDateTime: string;
    arriveDateTime: string;
    flightInfo: {
        airlineCode: string;
        flightNo: string;
    };
    duration: number;
}

export interface FlightData {
    journeyList: {
        transSectionList: FlightSection[];
        duration: number;
    }[];
    policies: {
        price: {
            totalPrice: number;
        };
        policyId: string;
    }[];
}

export interface FlightResponseData {
    basicInfo: { recordCount: number; productId: string };
    itineraryList: FlightData[];
}
