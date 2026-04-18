import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { Actor, Dataset, log } from 'apify';

import { ActorService } from './actor.service.js';
import { AppModule } from './app.module.js';
import type { Input } from './types.js';

await Actor.init();

const input = (await Actor.getInput<Input>()) ?? ({} as Input);

if (!input.mainDepartureCity || !input.targetCity || !input.timePeriods || input.timePeriods.length === 0) {
    throw new Error('Missing required input: mainDepartureCity, targetCity, and timePeriods are required');
}

log.info('Actor input received:', {
    mainDepartureCity: input.mainDepartureCity,
    targetCity: input.targetCity,
    alternativeDepartureCities: input.alternativeDepartureCities,
    cabinClass: input.cabinClass,
    numberOfPeople: input.numberOfPeople,
    timePeriodsCount: input.timePeriods.length,
    airlinesFilter: input.airlines && input.airlines.length > 0 ? input.airlines : 'none',
    maxFlightsPerSearch: input.maxFlightsPerSearch,
});

const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
const actorService = app.get(ActorService);
const sortedResults = await actorService.run(input);
await app.close();

log.info(`Crawler finished. Total results collected: ${sortedResults.length}`);

if (sortedResults.length === 0) {
    log.warning('No flight results found. Try adjusting search criteria or time periods.');
    await Actor.exit('No flights found matching your criteria');
}

await Dataset.pushData(sortedResults);

const cheapestFlight = sortedResults[0];
const expensiveFlight = sortedResults[sortedResults.length - 1];
const priceRange = expensiveFlight.totalPrice - cheapestFlight.totalPrice;

log.info(
    `Saved ${sortedResults.length} sorted results to dataset\n` +
    `    Cheapest flight: ${cheapestFlight.totalPrice} TWD (${cheapestFlight.pattern})\n` +
    `    Price range: ${cheapestFlight.totalPrice} - ${expensiveFlight.totalPrice} TWD (Δ${priceRange} TWD)`
);

await Actor.exit(
    `✅ Successfully found ${sortedResults.length} flight options! ` +
    `Cheapest: ${cheapestFlight.totalPrice} TWD via ${cheapestFlight.pattern}. ` +
    `Price range: ${priceRange} TWD.`
);
