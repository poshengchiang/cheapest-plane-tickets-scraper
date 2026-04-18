import { createCrawler } from './crawler/index.js';
import { createPipelineRequest } from './crawler/url-utils.js';
import { AlternativeRouteModule, DirectRouteModule } from './modules/index.js';
import { resultsStore } from './services/index.js';
import type { Input } from './types.js';

const modules = [DirectRouteModule, AlternativeRouteModule];

export async function createApp(input: Input) {
    const { maxFlightsPerSearch, timePeriods } = input;

    if (maxFlightsPerSearch) {
        resultsStore.setMaxLimit(maxFlightsPerSearch);
    }

    const crawler = await createCrawler();

    const startUrls = modules.flatMap((module) =>
        module.createSearchInfos(input, timePeriods).map((searchInfo) =>
            createPipelineRequest({ pipelineName: module.pipelineName, stepIndex: 0, searchInfo }),
        ),
    );

    return { crawler, startUrls };
}
