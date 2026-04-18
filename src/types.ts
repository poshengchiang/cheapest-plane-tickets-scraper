import type { PATTERN } from './constants.js';

export interface TimePeriod {
    outboundDate: string; // YYYY-MM-DD format
    inboundDate: string; // YYYY-MM-DD format
}

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
    maxFlightsPerSearch?: number; // Maximum flights to collect per search (default: 10)
}

interface BaseSearchInfo {
    departureCityCode: string;
    targetCityCode: string;
    departureDate: string; // YYYY-MM-DD format
    returnDate: string; // YYYY-MM-DD format
    cabinClass: string; // 'Y' for Economy, 'C' for Business, 'F' for First
    quantity: number; // Number of passengers
    airlines?: string[]; // Preferred airlines (optional)
}

export interface DirectRouteSearchInfo extends BaseSearchInfo {
    routeType: 'direct';
}

export interface AlternativeRouteSearchInfo extends BaseSearchInfo {
    routeType: 'alternative';
    intermediateCityCode: string;
}

export type SearchInfo = DirectRouteSearchInfo | AlternativeRouteSearchInfo;
export type PipelineName = 'direct' | 'alternative';

export interface OutboundPipelineUserData {
    pipelineName: PipelineName;
    stepIndex: number;
    searchInfo: SearchInfo;
    combinedFlight?: FlightInfo;
    sseResponsePromise?: Promise<FlightInfo[] | null>;
}

export interface InboundPipelineUserData {
    pipelineName: PipelineName;
    stepIndex: number;
    searchInfo: SearchInfo;
    lastFlight: FlightInfo;
    combinedFlight?: FlightInfo;
    flightResponsePromise?: Promise<FlightInfo[] | null>;
}

export type PipelineUserData = OutboundPipelineUserData | InboundPipelineUserData;

export interface FlightSegment {
    airline: string; // e.g., "EVA Air"
    flightNumber: string; // e.g., "BR189"
}

export interface FlightLeg {
    departureCityCode: string;
    departureAirport: string;
    departureTime: string; // ISO 8601 format
    arrivalCityCode: string;
    arrivalAirport: string;
    arrivalTime: string; // ISO 8601 format
    flightSegment: FlightSegment;
    durationTimeMinutes: number;
}

export interface FlightInfo {
    totalPrice: number;
    totalTimeMinutes: number;
    departureCityName: string;
    departureCityCode: string;
    targetCityName: string;
    targetCityCode: string;
    totalFlights: number;
    productId: string;
    policyId: string;
    flights: FlightLeg[];
}

export interface RouteResult {
    pattern: PATTERN;
    totalPrice: number;
    mainDepartureCity: string;
    intermediateCity: string | null;
    targetCity: string;
    departureDate: string;
    returnDate: string;
    totalTimeMinutes: number;
    flightInfo: FlightInfo;
}

interface FlightPoint {
    cityCode: string;
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

export type StepRole = 'fan-out' | 'combine' | 'save' | 'merge-save';

export type StepResult =
    | { type: 'advance'; combinedFlight: FlightInfo }
    | { type: 'save'; results: RouteResult[] };

export interface StepExecuteParams {
    flight: FlightInfo;
    lastFlight: FlightInfo;
    combinedFlight: FlightInfo | undefined;
    searchInfo: SearchInfo;
}

interface BaseStep {
    name: string;
    fanOut: number;
    role: StepRole;
    getCities: (searchInfo: SearchInfo) => { departureCityCode: string; targetCityCode: string };
}

export interface OutboundStep extends BaseStep {
    handler: 'outbound';
}

export interface InboundStep extends BaseStep {
    handler: 'inbound';
    execute: (params: StepExecuteParams) => StepResult;
}

export type PipelineStep = OutboundStep | InboundStep;
