export interface OutBoundParams {
    departureCityCode: string;
    arrivalCityCode: string;
    departureDate: string; // Departure date (YYYY-MM-DD format)
    returnDate: string; // Return date (YYYY-MM-DD format)
    class?: string; // Cabin class (default: 'y' for economy)
    quantity?: number; // Number of passengers (default: 1)
}

export function createOutBoundUrl(params: OutBoundParams): string {
    const {
        departureCityCode,
        arrivalCityCode,
        departureDate,
        returnDate,
        class: cabinClass = 'y',
        quantity = 1,
    } = params;

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
