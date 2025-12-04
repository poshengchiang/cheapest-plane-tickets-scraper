# Scraping Strategy - Cheapest Plane Tickets Scraper

## Overview

This Actor finds the cheapest plane tickets by scraping Trip.com and comparing:

- **Direct routes**: Main Departure City → Target City
- **Alternative routes**: Main Departure City → Intermediate City → Target City

The scraper searches for round-trip flights and intelligently combines flight legs to find the best deals.

---

## Input Parameters

### Required

- `mainDepartureCity` - Departure airport code (e.g., `TPE`)
- `targetCity` - Destination airport code (e.g., `PRG`)
- `timePeriods` - Array of travel dates:
    ```json
    [{ "outboundDate": "2025-12-10", "inboundDate": "2025-12-17" }]
    ```
- `cabinClass` - `Y` (Economy), `C` (Business), or `F` (First)
- `numberOfPeople` - Number of passengers (1-9)

### Optional

- `alternativeDepartureCities` - Array of intermediate cities (e.g., `["HKG", "ICN"]`)
- `airlines` - Filter by airlines (e.g., `["EVA", "China Airlines"]`)
- `maxRequestsPerCrawl` - Request limit (default: 1000)

---

## How It Works

### Direct Route (2 steps)

**Example: TPE → PRG**

1. **Step 1: Search outbound flights (TPE → PRG)**
    - Scrape top N cheapest flights
    - For each flight, create inbound search request

2. **Step 2: Search inbound flights (PRG → TPE)**
    - Search return flights for each outbound option
    - Combine outbound + inbound flights
    - Save to dataset

**Result:** Direct round-trip combinations

### Alternative Route (4 steps)

**Example: TPE → HKG → PRG (using HKG as intermediate city)**

> ⚠️ **Important Notice**: Leg 1 (Departure → Intermediate → Target) searches use the same date for both flights. This is **for price reference only** and may result in transfer time conflicts. The actual implementation does NOT validate transfer time feasibility for Leg 1 combinations.

1. **Step 1: Leg 1 Outbound (TPE → HKG)**
    - Search flights from main departure to intermediate city
    - Select top N cheapest options

2. **Step 2: Leg 1 Inbound (HKG → PRG)**
    - Search flights from intermediate to target city **on the same date**
    - Use the BEST (cheapest) option only
    - Combine Leg 1 outbound + inbound → `leg1FlightInfo`

3. **Step 3: Leg 2 Outbound (PRG → HKG)**
    - Search return flights from target to intermediate city
    - Select top N cheapest options

4. **Step 4: Leg 2 Inbound (HKG → TPE)**
    - Search final leg from intermediate back to main departure
    - Combine all 4 legs together
    - Save complete alternative route to dataset

**Result:** Alternative 4-leg round-trip combinations

---

## Data Extraction

### Trip.com API

The scraper uses Trip.com's internal API endpoints:

1. **Outbound search**: `https://tw.trip.com/flights/showfarefirst`
    - Returns SSE (Server-Sent Events) stream with flight data
    - Captured via preNavigationHook: `captureSSEResponseHook`

2. **Inbound search**: `https://tw.trip.com/flights/ShowFareNext`
    - Returns JSON response with flight data
    - Captured via preNavigationHook: `captureResponseHook`

### Output Schema

Each saved record contains:

```typescript
{
  pattern: "DIRECT_ROUTE" | "ALTERNATIVE_ROUTE",
  flightInfo: {
    totalPrice: number,
    totalTimeMinutes: number,
    departureCityCode: string,
    departureCityName: string,
    targetCityCode: string,
    targetCityName: string,
    totalFlights: number,  // 2 for direct, 4 for alternative
    productId: string,
    policyId: string,
    flights: [
      {
        departureCityCode: string,
        departureAirport: string,
        departureTime: string,  // ISO 8601
        arrivalCityCode: string,
        arrivalAirport: string,
        arrivalTime: string,
        flightSegment: {
          airline: string,
          flightNumber: string
        },
        durationTimeMinutes: number
      },
      // ... more flight legs
    ]
  }
}
```

---

## Performance

### Request Estimation

For `n` time periods, `m` alternative cities, and `N` = top flights limit (default: 3):

**Direct routes:**

- Step 1: `n` outbound searches (1 per time period)
- Step 2: `n × N` inbound searches (N for each outbound flight)
- **Total per route**: `n × (1 + N)` requests
- **Dataset items**: `n × N × N` combinations

**Alternative routes:**

- Step 1 (Leg 1 Outbound): `n × m` searches
- Step 2 (Leg 1 Inbound): `n × m × N` searches
- Step 3 (Leg 2 Outbound): `n × m × 1` searches (best option only)
- Step 4 (Leg 2 Inbound): `n × m × N` searches
- **Total per route**: `n × m × (1 + N + 1 + N)` = `n × m × (2 + 2N)` requests
- **Dataset items**: `n × m × N` combinations (pruned at Leg 1)

**Grand Total**: `n × (1 + N + m × (2 + 2N))` requests

**Example (N=3):**

- 2 time periods, 2 alternative cities
- Direct: 2 × (1 + 3) = **8 requests** → 18 dataset items
- Alternative: 2 × 2 × (2 + 6) = **32 requests** → 12 dataset items
- **Total: 40 requests, 30 dataset items**

### Optimizations

1. **Top N selection**: Only process top N cheapest flights at each step (default: 3)
2. **Alternative route pruning**: Use only BEST option for Leg 1 inbound, reducing from N² to N combinations
3. **Concurrent processing**: Crawlee handles parallel requests automatically (maxConcurrency: 3)
4. **Result sorting**: Final dataset sorted by price (cheapest first)

---

**Last Updated:** December 4, 2025  
**Status:** Implementation Complete
