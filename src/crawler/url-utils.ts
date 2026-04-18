import { LABELS } from '../constants.js';
import type { PipelineUserData } from '../types.js';
import { PIPELINES } from './pipeline-registry.js';

export function createPipelineRequest(userData: PipelineUserData) {
    const step = PIPELINES[userData.pipelineName][userData.stepIndex];
    const cities = step.getCities(userData.searchInfo);
    const { searchInfo } = userData;

    if (step.handler === 'outbound') {
        return {
            url: createOutBoundUrl({
                ...cities,
                departureDate: searchInfo.departureDate,
                returnDate: searchInfo.returnDate,
                cabinClass: searchInfo.cabinClass,
                quantity: searchInfo.quantity,
                airlines: searchInfo.airlines,
            }),
            label: LABELS.SEARCH_OUTBOUND,
            userData,
        };
    }

    if (!('lastFlight' in userData)) throw new Error(`Step '${step.name}' requires InboundPipelineUserData`);
    return {
        url: createInboundUrl({
            ...cities,
            departureDate: searchInfo.departureDate,
            returnDate: searchInfo.returnDate,
            productId: userData.lastFlight.productId,
            policyId: userData.lastFlight.policyId,
            cabinClass: searchInfo.cabinClass,
            quantity: searchInfo.quantity,
            airlines: searchInfo.airlines,
        }),
        label: LABELS.SEARCH_INBOUND,
        userData,
    };
}

export interface OutBoundParams {
    departureCityCode: string;
    targetCityCode: string;
    departureDate: string;
    returnDate: string;
    cabinClass?: string;
    quantity?: number;
    airlines?: string[];
}

export function createOutBoundUrl(params: OutBoundParams): string {
    const {
        departureCityCode,
        targetCityCode,
        departureDate,
        returnDate,
        cabinClass = 'y',
        quantity = 1,
        airlines = [],
    } = params;

    const baseUrl = 'https://tw.trip.com/flights/showfarefirst';
    const searchParams = new URLSearchParams({
        dcity: departureCityCode,
        acity: targetCityCode,
        ddate: departureDate,
        rdate: returnDate,
        triptype: 'rt',
        class: cabinClass,
        lowpricesource: 'searchform',
        quantity: String(quantity),
        searchboxarg: 't',
        nonstoponly: 'off',
        sort: 'direct',
    });

    if (airlines.length > 0) {
        searchParams.append('airline', airlines.join(','));
    }

    return `${baseUrl}?${searchParams.toString()}`;
}

export interface InBoundParams {
    departureCityCode: string;
    targetCityCode: string;
    departureDate: string;
    returnDate: string;
    productId: string;
    policyId: string;
    locale?: string;
    curr?: string;
    cabinClass?: string;
    quantity?: number;
    childqty?: number;
    babyqty?: number;
    airlines?: string[];
}

export function createInboundUrl(params: InBoundParams): string {
    const {
        departureCityCode,
        targetCityCode,
        departureDate,
        returnDate,
        productId,
        policyId,
        locale = 'zh-TW',
        curr = 'TWD',
        cabinClass = 'Y',
        quantity = 1,
        childqty = 0,
        babyqty = 0,
        airlines = [],
    } = params;

    const baseUrl = 'https://tw.trip.com/flights/ShowFareNext';
    const searchParams = new URLSearchParams({
        pagesource: 'list',
        triptype: 'RT',
        class: cabinClass,
        quantity: String(quantity),
        childqty: String(childqty),
        babyqty: String(babyqty),
        jumptype: 'GoToNextJournay',
        dcity: departureCityCode,
        acity: targetCityCode,
        ddate: departureDate,
        rdate: returnDate,
        currentseqno: '2',
        criteriaToken: productId,
        shoppingid: policyId,
        groupKey: policyId,
        locale,
        curr,
        sort: 'direct',
    });

    if (airlines.length > 0) {
        searchParams.append('airline', airlines.join(','));
    }

    return `${baseUrl}?${searchParams.toString()}`;
}
