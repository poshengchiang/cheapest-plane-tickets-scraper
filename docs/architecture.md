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
  main.ts                       Bootstrap only: init, validate input, run app, push results
  app.ts                        Main module: registers route modules, creates crawler
  types.ts                      Shared TypeScript interfaces and types
  constants.ts                  LABELS enum, shared constants

  crawler/                      Crawler infrastructure (internal to app.ts)
    index.ts                    Public API: createCrawler()
    hooks.ts                    Pre-navigation hooks that capture SSE and JSON responses
    router.ts                   Two generic route handlers (SEARCH_OUTBOUND / SEARCH_INBOUND)
    helpers.ts                  Flight data validation helper
    pipeline-registry.ts        Maps pipeline names to their PipelineStep arrays
    url-utils.ts                URL builders and createPipelineRequest factory

  modules/                      Route modules — one per search pattern
    index.ts                    Barrel: re-exports all route modules
    direct-route/
      index.ts                  Public: DirectRouteModule (pipelineName, pipeline, createSearchInfos)
      pipeline.ts               2-step pipeline definition (internal)
    alternative-route/
      index.ts                  Public: AlternativeRouteModule
      pipeline.ts               4-step pipeline definition (internal)
      combiners.ts              Flight leg merging logic (internal)

  services/                     Shared services
    index.ts                    Barrel: re-exports public service API
    ResultsStore.ts             Key-value store wrapper for accumulating RouteResults
    flight-data.ts              Trip.com response parsing and flight combining
```

---

## Module responsibilities

| Layer | File(s) | Knows about |
|---|---|---|
| Bootstrap | `main.ts` | Actor lifecycle, Dataset output |
| Wiring | `app.ts` | Which modules exist, crawler setup |
| Crawler infra | `crawler/` | Playwright mechanics, pipeline dispatch |
| Business logic | `modules/*/` | Route-specific cities, pipeline steps |
| Shared services | `services/` | Result storage, flight data parsing |

`app.ts` is the single place to register a new route module. `main.ts` never needs to change when adding search patterns.

---

## Request flow

Each Crawlee request carries a `PipelineUserData` object with:
- `pipelineName` — which pipeline (`'direct'` or `'alternative'`)
- `stepIndex` — position in the pipeline
- `searchInfo` — cities, dates, cabin class, etc.
- `lastFlight` — the flight selected in the previous outbound step (provides `productId` for the next URL)
- `combinedFlight` — accumulated combined flight from earlier steps (used in alternative route)

`SEARCH_OUTBOUND` fans out to the next step for each top-N flight. `SEARCH_INBOUND` calls `step.execute()` with the current flight data and dispatches on the returned `StepResult` — either advancing the pipeline or saving results. The handlers in `crawler/router.ts` have no knowledge of route-specific logic.

See [pipeline-design.md](./pipeline-design.md) for step roles and pipeline diagrams.
