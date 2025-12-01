import { createPlaywrightRouter, Dataset } from 'crawlee';

import { LABELS } from './constants.js';
import { createOutBoundUrl } from './utils.js';

export const router = createPlaywrightRouter();

// Default handler for debugging
router.addDefaultHandler(async ({ request, log }) => {
    log.info(`DEFAULT HANDLER CALLED for: ${request.url}`, { label: request.label });
});

router.addHandler(LABELS.START, async ({ request, log, crawler }) => {
    log.info(`Processing START handler: ${request.loadedUrl}`);

    const outBoundUrl = createOutBoundUrl({
        departureCityCode: 'tpe',
        arrivalCityCode: 'prg',
        departureDate: '2025-12-02',
        returnDate: '2025-12-05',
        class: 'y',
        quantity: 1,
    });

    log.info(`Enqueueing OUT_BOUND request: ${outBoundUrl}`);

    await crawler.addRequests([
        {
            url: outBoundUrl,
            label: LABELS.OUT_BOUND,
        },
    ]);
});

router.addHandler(LABELS.OUT_BOUND, async ({ request, page, log }) => {
    const title = await page.title();
    log.info(`${title}`, { url: request.loadedUrl });

    await Dataset.pushData({
        url: request.loadedUrl,
        title,
    });
});

router.addHandler(LABELS.IN_BOUND, async ({ request, page, log }) => {
    const title = await page.title();
    log.info(`${title}`, { url: request.loadedUrl });

    await Dataset.pushData({
        url: request.loadedUrl,
        title,
    });
});
