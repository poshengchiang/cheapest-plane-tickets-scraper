# Cheapest Plane Tickets Scraper

> **For users**: See [.actor/README.md](.actor/README.md) for usage instructions on Apify platform.

Developer documentation for the Cheapest Plane Tickets Scraper Actor. This Actor scrapes Trip.com to find cheap flight combinations by comparing direct routes and multi-city alternatives.

## 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/poshengchiang/cheapest-plane-tickets-scraper.git
cd cheapest-plane-tickets-scraper

# Install dependencies
npm install

# Run locally
apify run

# Deploy to Apify
apify login
apify push
```

## 🏗️ Architecture

### Request Flow

**Direct Route (2 steps):**

1. `DIRECT_OUTBOUND`: Search TPE → PRG (select top 3)
2. `DIRECT_INBOUND`: For each outbound, search PRG → TPE

**Alternative Route (4 steps):**

1. `ALT_LEG1_OUTBOUND`: TPE → HKG (top 3)
2. `ALT_LEG1_INBOUND`: HKG → PRG (best only)
3. `ALT_LEG2_OUTBOUND`: PRG → HKG (top 3)
4. `ALT_LEG2_INBOUND`: HKG → TPE (combine all)

### Key Components

- **`src/main.ts`**: Actor entry point, initializes crawler
- **`src/routes.ts`**: Router with 6 handlers (exports `router` and `resultsStore`)
- **`src/utils.ts`**: Request factory with discriminated unions
- **`src/ResultsStore.ts`**: Key-value store wrapper for results accumulation
- **`src/hooks.ts`**: Pre-navigation hooks for SSE/JSON capture
- **`src/types.ts`**: TypeScript type definitions
- **`src/constants.ts`**: Labels, patterns, limits

### Data Flow

1. Route handlers scrape flight data from Trip.com
2. Results saved to `ResultsStore` (key-value store)
3. After crawl completion, `main.ts` retrieves and sorts all results
4. Sorted results pushed to dataset in one batch

### Performance

**Request Estimation:**

For `n` time periods, `m` intermediate cities, `N=3` top flights:

- **Direct routes**: `n × (1 + N)` = 4n requests → `n × N²` = 9n items
- **Alternative routes**: `n × m × (2 + 2N)` = 8nm requests → `n × m × N` = 3nm items
- **Total**: `n(4 + 8m)` requests, `n(9 + 3m)` items

**Example**: 2 periods, 2 intermediate cities = 40 requests, 30 items (~3-5 min)

## 📝 Configuration Files

- **`.actor/input_schema.json`**: Apify Console input form definition
- **`.actor/output_schema.json`**: Output tab configuration
- **`.actor/dataset_schema.json`**: Dataset view with field display
- **`.actor/actor.json`**: Actor metadata and settings

## 🧪 Testing Locally

```bash
# Run with default input
apify run

# Run with custom input
cat > storage/key_value_stores/default/INPUT.json << 'EOF'
{
  "mainDepartureCity": "TPE",
  "targetCity": "HKG",
  "cabinClass": "Y",
  "numberOfPeople": 1,
  "timePeriods": [{"outboundDate": "2026-02-01", "inboundDate": "2026-02-05"}],
  "maxRequestsPerCrawl": 100
}
EOF
apify run
```
