# Pipeline Design

## Why pipelines?

Before this refactor, each route handler hardcoded which label to queue next:

```ts
// Old: ALT_OUTBOUND_LEG1 handler knew it should go to ALT_OUTBOUND_LEG2
createRequest({ label: LABELS.ALT_OUTBOUND_LEG2, ... })
```

This scattered flow logic across 6 handlers. Adding a new route pattern meant adding new labels, new handlers, and updating multiple files.

After the refactor, the complete flow is declared in one place (`pipeline.ts`), and the two generic handlers simply advance through it.

---

## Step roles

Each pipeline step has a `role` that tells the `SEARCH_INBOUND` handler what to do with the flight data:

| Role | What happens |
|---|---|
| `fan-out` | SSE step — select top N flights, queue each as the next step |
| `combine` | Combine `lastFlight` + current flight → carry forward as `combinedFlight` |
| `save` | Combine `lastFlight` + current flight → save as a direct route result |
| `merge-save` | Combine `lastFlight` + current flight as leg2, merge with `combinedFlight` (leg1) → save as alternative route result |

`fan-out` is always handled by `SEARCH_OUTBOUND`. The other three roles are handled by `SEARCH_INBOUND`.

---

## Direct route pipeline

```
SEARCH_OUTBOUND (sse, fan-out)     A → C   get top N outbound flights
SEARCH_INBOUND  (flight, save)     C → A   for each, get return flights → combine & save
```

---

## Alternative route pipeline

```
SEARCH_OUTBOUND (sse, fan-out)     A → B   get top N flights to intermediate
SEARCH_INBOUND  (flight, combine)  B → C   for each, get onward flights → combine into leg1 (combinedFlight)
SEARCH_OUTBOUND (sse, fan-out)     C → B   get top N return flights from target
SEARCH_INBOUND  (flight, merge-save) B → A for each, get final leg → combine into leg2, merge with leg1 → save
```

---

## Adding a new pipeline

1. Define the steps in `pipeline.ts` and add the new name to `PIPELINES`
2. Add the new `PipelineName` literal to the union in `types.ts`
3. Call `createPipelineRequest({ pipelineName: 'new-name', stepIndex: 0, searchInfo })` from `main.ts`

No changes needed to `routes.ts`, `hooks.ts`, or `utils.ts`.

---

## Key types

```ts
// types.ts
interface PipelineUserData {
    pipelineName: PipelineName;       // 'direct' | 'alternative'
    stepIndex: number;                // current position in the pipeline
    searchInfo: SearchInfo;           // cities, dates, cabin class
    lastFlight?: FlightInfo;          // selected flight from previous SSE step
    combinedFlight?: FlightInfo;      // accumulated leg1 result (alternative route only)
}

// pipeline.ts
interface PipelineStep {
    name: string;                     // for logging
    responseType: 'sse' | 'flight';
    fanOut: number;                   // max results to advance to next step
    role: StepRole;
    getCities: (searchInfo) => { departureCityCode, targetCityCode };
}
```

---

## Label naming rationale

`SEARCH_OUTBOUND` and `SEARCH_INBOUND` reflect the **commercial intent** of each step:
- `SEARCH_OUTBOUND` — initiates a new flight search (Trip.com `showfarefirst`, SSE response)
- `SEARCH_INBOUND` — continues a search to get the return leg (Trip.com `ShowFareNext`, JSON response)

The specific step names (outbound-leg1, inbound-leg2, etc.) live as `name` strings inside each `PipelineStep` for logging purposes only.
