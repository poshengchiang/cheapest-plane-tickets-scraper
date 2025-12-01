import { createPlaywrightRouter, Dataset } from 'crawlee';

import { LABELS } from './constants.js';

export const router = createPlaywrightRouter();

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
