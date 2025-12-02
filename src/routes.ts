import { createPlaywrightRouter, Dataset } from 'crawlee';

import { LABELS } from './constants.js';

export const router = createPlaywrightRouter();

router.addHandler(LABELS.OUT_BOUND, async ({ request, log, page }) => {
    if (request.userData.processed) {
        log.info(`Request already processed: ${request.loadedUrl}`);
        return;
    }

    await page.waitForTimeout(3000);
    if (!request.userData.processed) {
        log.warning(`Request still not processed after waiting: ${request.loadedUrl}`);
    }
});

router.addHandler(LABELS.IN_BOUND, async ({ request, page, log }) => {
    const title = await page.title();
    log.info(`${title}`, { url: request.loadedUrl });

    await Dataset.pushData({
        url: request.loadedUrl,
        title,
    });
});
