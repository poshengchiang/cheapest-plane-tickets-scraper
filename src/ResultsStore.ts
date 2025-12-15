import { Actor } from 'apify';

import { RESULTS_KEY } from './constants.js';
import type { RouteResult } from './types.js';

/**
 * Manages flight results storage using Apify key-value store
 * Provides thread-safe operations for appending and retrieving results
 */
class ResultsStore {
    private flightsCount = 0;
    private maxLimit = 10;

    /**
     * Sets the maximum limit for flights to collect
     * @param limit - Maximum number of flights
     */
    setMaxLimit(limit: number): void {
        this.maxLimit = limit;
    }

    /**
     * Checks if the flight count has reached or exceeded the limit
     * @returns True if limit is reached, false otherwise
     */
    isReachLimit(): boolean {
        return this.flightsCount >= this.maxLimit;
    }

    /**
     * Appends new flight results to the store
     * @param results - Array of route results to append
     */
    async append(results: RouteResult[]): Promise<void> {
        const existingResults = (await Actor.getValue<RouteResult[]>(RESULTS_KEY)) || [];
        await Actor.setValue(RESULTS_KEY, [...existingResults, ...results]);
        this.flightsCount += results.length;
    }

    /**
     * Retrieves all stored flight results
     * @returns Array of all route results
     */
    async getAll(): Promise<RouteResult[]> {
        return (await Actor.getValue<RouteResult[]>(RESULTS_KEY)) || [];
    }

    /**
     * Retrieves all results sorted by total price (ascending)
     * @returns Array of route results sorted by price
     */
    async getAllSorted(): Promise<RouteResult[]> {
        const results = await this.getAll();
        return results.sort((a, b) => a.totalPrice - b.totalPrice);
    }

    /**
     * Clears all stored results
     * Useful for testing or resetting state
     */
    async clear(): Promise<void> {
        await Actor.setValue(RESULTS_KEY, []);
    }
}

export const resultsStore = new ResultsStore();
