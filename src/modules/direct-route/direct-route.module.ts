import { Module } from '@nestjs/common';

import { ServicesModule } from '../../services/services.module.js';
import { DirectRouteService } from './direct-route.service.js';

@Module({
    imports: [ServicesModule],
    providers: [DirectRouteService],
    exports: [DirectRouteService],
})
export class DirectRouteModule {}
