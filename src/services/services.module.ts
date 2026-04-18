import { Module } from '@nestjs/common';

import { FlightDataService } from './flight-data.service.js';
import { ResultsStoreService } from './results-store.service.js';

@Module({
    providers: [FlightDataService, ResultsStoreService],
    exports: [FlightDataService, ResultsStoreService],
})
export class ServicesModule {}
