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

Each pipeline step has a `role` that describes its intent in the flow:

| Role | Handled by | What happens |
|---|---|---|
| `fan-out` | `SEARCH_OUTBOUND` | Select top N flights, queue each as the next step |
| `combine` | `SEARCH_INBOUND` | `execute()` combines lastFlight + current → carry forward as `combinedFlight` |
| `save` | `SEARCH_INBOUND` | `execute()` combines lastFlight + current → save as a direct route result |
| `merge-save` | `SEARCH_INBOUND` | `execute()` combines lastFlight + current as leg2, merges with `combinedFlight` (leg1) → save as alternative route result |

`SEARCH_INBOUND` calls `step.execute()` and dispatches on the returned `StepResult` — it has no knowledge of which route type it's serving.

---

## Direct route pipeline

```
SEARCH_OUTBOUND (outbound, fan-out)   A → C   get top N outbound flights
SEARCH_INBOUND  (inbound, save)       C → A   for each, get return flights → combine & save
```

---

## Alternative route pipeline

```
SEARCH_OUTBOUND (outbound, fan-out)      A → B   get top N flights to intermediate
SEARCH_INBOUND  (inbound, combine)       B → C   for each, get onward flights → combine into leg1 (combinedFlight)
SEARCH_OUTBOUND (outbound, fan-out)      C → B   get top N return flights from target
SEARCH_INBOUND  (inbound, merge-save)    B → A   for each, get final leg → combine into leg2, merge with leg1 → save
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
    lastFlight?: FlightInfo;          // selected flight from previous outbound step
    combinedFlight?: FlightInfo;      // accumulated leg1 result (alternative route only)
}

// pipeline.ts — discriminated union on handler
type SSEStep = BaseStep & { handler: 'outbound' }
type FlightStep = BaseStep & {
    handler: 'inbound';
    execute: (params: StepExecuteParams) => StepResult;
}
type PipelineStep = SSEStep | FlightStep;

type StepResult =
    | { type: 'advance'; combinedFlight: FlightInfo }
    | { type: 'save'; results: RouteResult[] };
```

`execute` is required on `FlightStep` and absent on `SSEStep` — enforced at compile time via the discriminated union.

---

## Label naming rationale

`SEARCH_OUTBOUND` and `SEARCH_INBOUND` reflect the **commercial intent** of each step:
- `SEARCH_OUTBOUND` — initiates a new flight search (Trip.com `showfarefirst`, SSE response)
- `SEARCH_INBOUND` — continues a search to get the return leg (Trip.com `ShowFareNext`, JSON response)

The `handler` field on each `PipelineStep` (`'outbound'` | `'inbound'`) mirrors these labels directly, decoupling the step definition from the transport protocol (SSE vs JSON).
