import { Actor, log } from 'apify';
import { PlaywrightCrawler } from 'crawlee';

import { resultsStore } from '../services/ResultsStore.js';
import { captureResponseHook, captureSSEResponseHook } from './hooks.js';
import { router } from './router.js';

export async function createCrawler() {
    const proxyConfiguration = await Actor.createProxyConfiguration({
        groups: ['RESIDENTIAL'],
    });

    return new PlaywrightCrawler({
        proxyConfiguration,
        maxConcurrency: 3,
        headless: true,
        requestHandler: async (context) => {
            if (resultsStore.isReachLimit()) {
                log.info('Flight limit reached, skipping request', { label: context.request.label });
                context.request.noRetry = true;
                return;
            }
            await router(context);
        },
        navigationTimeoutSecs: 60,
        preNavigationHooks: [captureSSEResponseHook, captureResponseHook],
        launchContext: {
            launchOptions: {
                args: ['--disable-gpu'],
            },
        },
    });
}
