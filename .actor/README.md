# Cheapest Plane Tickets Scraper

Find the cheapest flights on Trip.com by comparing direct routes and creative multi-city combinations.

## 🎯 What It Does

This Actor helps you discover cheap flight options by checking:

- **Direct Routes**: Standard round-trips (e.g., TPE → PRG → TPE)
- **Alternative Routes**: Multi-city combinations that might be cheaper (e.g., TPE → HKG → PRG → HKG → TPE)

### Example

You want to fly from Taipei (TPE) to Prague (PRG):

- **Direct route**: TPE → PRG costs $30,000 TWD
- **Via Hong Kong**: TPE → HKG → PRG might cost $22,000 TWD

💡 This Actor finds these opportunities automatically!

## ⚠️ Important Notice

**This is a price discovery tool, not a booking system.**

Alternative routes show potential savings but may have:

- ❌ Insufficient transfer time between flights
- ❌ Timing conflicts
- ❌ Flights that don't actually connect

**Always verify the actual flight times and connections on Trip.com before booking.**

## 📊 Results

The Actor provides a sorted list of flight options (cheapest first) showing:

- ✈️ Route type (direct or alternative)
- 💰 Total price
- 🌍 All cities involved
- 📅 Departure and return dates
- ⏱️ Total travel time
- 🔍 Complete flight details for each leg

### How to Use Results

1. **Review the cheapest options** at the top of the dataset
2. **For direct routes**: Book directly on Trip.com
3. **For alternative routes**:
    - Note the price savings
    - Check Trip.com manually for actual availability
    - Verify transfer times are realistic
    - Book each leg separately if timing works

## 💡 Use Cases

### Budget Travel Planning

"I want to visit Europe from Asia - which routing saves the most money?"

### Flexible Routing

"Is it cheaper to fly via Hong Kong, Seoul, or Singapore?"

### Price Comparison

"How much can I save with alternative routing vs direct flights?"

## ⏱️ Expected Runtime

- **Direct routes only**: 1-2 minutes
- **With 2 intermediate cities**: 3-5 minutes
- **Multiple travel periods**: Scales proportionally
