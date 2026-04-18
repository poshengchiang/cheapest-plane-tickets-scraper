# Architecture Overview

## What this scraper does

Searches Trip.com for the cheapest round-trip flights between a departure city and a target city. It compares two strategies:

1. **Direct route** — one flight each way (A → C, C → A)
2. **Alternative route** — two flights each way via an intermediate city (A → B → C, C → B → A)

Results are sorted by total price and saved to the Apify Dataset.

---

## File structure

```
src/
  main.ts          Entry point: validates input, builds start URLs, runs crawler
  pipeline.ts      Pipeline definitions — the single source of truth for flow logic
  routes.ts        Two generic route handlers (SEARCH_OUTBOUND / SEARCH_INBOUND)
  hooks.ts         Pre-navigation hooks that capture SSE and JSON responses from Trip.com
  helpers.ts       Flight data validation helper
  utils.ts         URL builders and createPipelineRequest
  combiners.ts     Flight combination logic (combineOutboundInbound, combineAlternativeRoute)
  types.ts         TypeScript types
  constants.ts     LABELS enum, shared constants
  ResultsStore.ts  Key-value store wrapper for accumulating results
```

---

## Request flow

Each Crawlee request carries a `PipelineUserData` object with:
- `pipelineName` — which pipeline (`'direct'` or `'alternative'`)
- `stepIndex` — position in the pipeline
- `searchInfo` — cities, dates, cabin class, etc.
- `lastFlight` — the flight selected in the previous outbound step (provides `productId` for the next URL)
- `combinedFlight` — accumulated combined flight from earlier steps (used in alternative route)

`SEARCH_OUTBOUND` fans out to the next step for each top-N flight. `SEARCH_INBOUND` calls `step.execute()` with the current flight data and dispatches on the returned `StepResult` — either advancing the pipeline or saving results. The handlers have no knowledge of route-specific logic.
