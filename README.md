# Cheapest Plane Tickets Scraper

Find the cheapest flights on Trip.com by comparing direct routes and creative multi-city combinations.

## 🎯 What It Does

Discovers cheap flights using two strategies:

- **Direct Routes**: TPE → PRG (standard round-trip)
- **Alternative Routes**: TPE → HKG → PRG (multi-city combinations)

⚠️ **Note**: This is a price discovery tool. Alternative routes may have timing conflicts—verify manually on Trip.com before booking.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run locally
apify run

# Deploy to Apify
apify login
apify push
```

## 📥 Input

**Required:**

- `mainDepartureCity` - Departure airport code (e.g., `TPE`)
- `targetCity` - Destination airport code (e.g., `PRG`)
- `cabinClass` - `Y` (Economy), `C` (Business), `F` (First)
- `numberOfPeople` - Passengers (1-9)

**Optional:**

- `timePeriods` - Travel dates (defaults to 30 days from now)
- `alternativeDepartureCities` - Intermediate cities (e.g., `["HKG", "ICN"]`)
- `airlines` - Filter by airlines
- `maxRequestsPerCrawl` - Request limit (default: 1000)

## 📊 Output

Dataset sorted by price (cheapest first) with:

- Route type (direct/alternative)
- Total price (TWD)
- Departure/destination/intermediate cities
- Travel dates and duration
- Complete flight details

## 🔍 How It Works

### Direct Route (2 steps)

1. Search outbound flights (TPE → PRG) - select top 3
2. For each outbound, search inbound flights (PRG → TPE)
3. Save all combinations

### Alternative Route (4 steps)

1. **Leg 1 Out**: TPE → HKG (top 3)
2. **Leg 1 In**: HKG → PRG (best only)
3. **Leg 2 Out**: PRG → HKG (top 3)
4. **Leg 2 In**: HKG → TPE (all combinations)
5. Save complete 4-leg journeys

⚠️ Leg 1 searches same-day connections for price reference only—transfer times not validated.

## 🛠️ Technical Details

- **Framework**: Crawlee + Playwright
- **Data Source**: Trip.com Taiwan API (SSE + JSON)
- **Storage**: Results stored in key-value store, then sorted and saved to dataset
- **Concurrency**: 3 parallel requests
- **Performance**: ~40 requests for 2 time periods + 2 intermediate cities
