import { AlternativeRouteModule } from '../modules/alternative-route/index.js';
import { DirectRouteModule } from '../modules/direct-route/index.js';
import type { PipelineName, PipelineStep } from '../types.js';

export const PIPELINES: Record<PipelineName, PipelineStep[]> = {
    [DirectRouteModule.pipelineName]: DirectRouteModule.pipeline,
    [AlternativeRouteModule.pipelineName]: AlternativeRouteModule.pipeline,
};
