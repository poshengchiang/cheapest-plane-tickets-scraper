import { Module } from '@nestjs/common';

import { ServicesModule } from '../../services/services.module.js';
import { AlternativeRouteService } from './alternative-route.service.js';

@Module({
    imports: [ServicesModule],
    providers: [AlternativeRouteService],
    exports: [AlternativeRouteService],
})
export class AlternativeRouteModule {}
