import { Actor } from 'apify';

import { RESULTS_KEY } from './constants.js';
import type { RouteResult } from './types.js';

class ResultsStore {
    private flightsCount = 0;
    private maxLimit = 10;

    setMaxLimit(limit: number): void {
        this.maxLimit = limit;
    }

    isReachLimit(): boolean {
        return this.flightsCount >= this.maxLimit;
    }

    async append(results: RouteResult[]): Promise<void> {
        const existingResults = (await Actor.getValue<RouteResult[]>(RESULTS_KEY)) || [];
        await Actor.setValue(RESULTS_KEY, [...existingResults, ...results]);
        this.flightsCount += results.length;
    }

    async getAll(): Promise<RouteResult[]> {
        return (await Actor.getValue<RouteResult[]>(RESULTS_KEY)) || [];
    }

    async getAllSorted(): Promise<RouteResult[]> {
        const results = await this.getAll();
        return results.sort((a, b) => a.totalPrice - b.totalPrice);
    }

    async clear(): Promise<void> {
        await Actor.setValue(RESULTS_KEY, []);
    }
}

export const resultsStore = new ResultsStore();
