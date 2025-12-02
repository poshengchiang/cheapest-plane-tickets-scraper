export interface OutBoundParams {
    departureCityCode: string;
    arrivalCityCode: string;
    departureDate: string; // Departure date (YYYY-MM-DD format)
    returnDate: string; // Return date (YYYY-MM-DD format)
    cabinClass?: string; // Cabin class (default: 'y' for economy)
    quantity?: number; // Number of passengers (default: 1)
}

export function createOutBoundUrl(params: OutBoundParams): string {
    const { departureCityCode, arrivalCityCode, departureDate, returnDate, cabinClass = 'y', quantity = 1 } = params;

    const baseUrl = 'https://tw.trip.com/flights/showfarefirst';
    const searchParams = new URLSearchParams({
        dcity: departureCityCode,
        acity: arrivalCityCode,
        ddate: departureDate,
        rdate: returnDate,
        triptype: 'rt', // Round trip
        class: cabinClass,
        lowpricesource: 'searchform',
        quantity: String(quantity),
        searchboxarg: 't',
        nonstoponly: 'off',
        sort: 'price',
    });

    return `${baseUrl}?${searchParams.toString()}`;
}

export interface InBoundParams {
    departureCityCode: string; // Departure city code (e.g., 'tpe')
    arrivalCityCode: string; // Arrival city code (e.g., 'prg')
    departureDate: string; // Departure date (YYYY-MM-DD format)
    returnDate: string; // Return date (YYYY-MM-DD format)
    // dcityName: string; // Departure city name (e.g., 'Taipei'), but seems not required
    // acityName: string; // Arrival city name (e.g., 'Prague'), but seems not required
    productId: string; // Product ID from first flight page (criteriaToken)
    policyId: string; // Policy ID from first flight page (shoppingid and groupKey)
    locale?: string; // Locale (default: 'zh-TW')
    curr?: string; // Currency (default: 'TWD')
    cabinClass?: string; // Cabin class (default: 'Y')
    quantity?: number; // Number of passengers (default: 1)
    childqty?: number; // Number of children (default: 0)
    babyqty?: number; // Number of babies (default: 0)
}

export function createInBoundUrl(params: InBoundParams): string {
    const {
        departureCityCode,
        arrivalCityCode,
        departureDate,
        returnDate,
        productId,
        policyId,
        locale = 'zh-TW',
        curr = 'TWD',
        cabinClass = 'Y',
        quantity = 1,
        childqty = 0,
        babyqty = 0,
    } = params;

    const baseUrl = 'https://tw.trip.com/flights/ShowFareNext';
    const searchParams = new URLSearchParams({
        pagesource: 'list',
        triptype: 'RT',
        class: cabinClass,
        quantity: String(quantity),
        childqty: String(childqty),
        babyqty: String(babyqty),
        jumptype: 'GoToNextJournay',
        dcity: departureCityCode,
        acity: arrivalCityCode,
        ddate: departureDate,
        rdate: returnDate,
        currentseqno: '2',
        criteriaToken: productId,
        shoppingid: policyId,
        groupKey: policyId,
        locale,
        curr,
    });

    return `${baseUrl}?${searchParams.toString()}`;
}

export function extractOutboundFlightData(sseResponseData: any): RouteResult | null {
    try {
        const { recordCount } = sseResponseData.basicInfo;
        if (recordCount <= 1) {
            log.warning('No outbound flights found in SSE response', { recordCount });
        }

        const flightsData = sseResponseData.itineraryList || [];

        const flightInfos: FlightInfo[] = flightsData.map((flightData: any) => {
            const { totalPrice } = flightData.policies[0].price;
            const totalFlights = flightData.journeyList[0].transSectionList.length;
            const totalTimeMinutes = flightData.journeyList[0].duration;

            const departureCity = flightData.journeyList[0].transSectionList[0].departPoint.cityName;
            const targetCity = flightData.journeyList[0].transSectionList[totalFlights - 1].arrivePoint.cityName;

            const flights = flightData.journeyList[0].transSectionList.map((flightSection: any) => {
                return {
                    departureAirport: flightSection.departPoint.airportCode,
                    departureTime: flightSection.departDateTime,
                    arrivalAirport: flightSection.arrivePoint.airportCode,
                    arrivalTime: flightSection.arriveDateTime,
                    flightSegment: {
                        airline: flightSection.flightInfo.airlineCode,
                        flightNumber: flightSection.flightInfo.flightNo,
                    },
                    durationTimeMinutes: flightSection.duration,
                };
            });

            return {
                totalPrice,
                totalTimeMinutes,
                departureCity,
                targetCity,
                totalFlights,
                flights,
            };
        });

        return flightInfos;
    } catch (error) {
        log.error('Failed to extract flight data', { error, sseResponse });
        return null;
    }
}
