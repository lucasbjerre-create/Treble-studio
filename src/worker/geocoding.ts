// Nominatim (OpenStreetMap) usage policy requires a distinctive User-Agent
// identifying the app and a contact - https://operations.osmfoundation.org/policies/nominatim/.
// Browsers can't set a custom User-Agent header, so these calls happen here
// in the Worker, never client-side. That policy also explicitly bans
// autocomplete-as-you-type ("must not implement such a service on the
// client side"), which is why the client only calls this on an explicit
// "Look up" click or once per photo upload, never while typing.
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'exchange-year-site/1.0 (lucasbjerre@gmail.com)';

export interface GeocodeResult {
	label: string;
	lat: number;
	lon: number;
}

interface NominatimAddress {
	city?: string;
	town?: string;
	village?: string;
	municipality?: string;
	country?: string;
}

function cityLabel(address: NominatimAddress | undefined, fallbackName: string): string {
	const city = address?.city ?? address?.town ?? address?.village ?? address?.municipality ?? fallbackName;
	return address?.country ? `${city}, ${address.country}` : city;
}

export async function geocodeCity(query: string): Promise<GeocodeResult | null> {
	const url = new URL(`${NOMINATIM_BASE}/search`);
	url.searchParams.set('q', query);
	url.searchParams.set('format', 'jsonv2');
	url.searchParams.set('addressdetails', '1');
	url.searchParams.set('limit', '1');

	const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
	if (!res.ok) return null;
	const results = (await res.json()) as Array<{ lat: string; lon: string; name: string; address?: NominatimAddress }>;
	const top = results[0];
	if (!top) return null;
	return { label: cityLabel(top.address, top.name), lat: Number(top.lat), lon: Number(top.lon) };
}

// zoom=10 asks Nominatim for city-level detail, not a street address -
// matches "an overview, not an exact address" rather than full precision.
export async function reverseGeocodeCity(lat: number, lon: number): Promise<string | null> {
	const url = new URL(`${NOMINATIM_BASE}/reverse`);
	url.searchParams.set('lat', String(lat));
	url.searchParams.set('lon', String(lon));
	url.searchParams.set('format', 'jsonv2');
	url.searchParams.set('addressdetails', '1');
	url.searchParams.set('zoom', '10');

	const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
	if (!res.ok) return null;
	const result = (await res.json()) as { address?: NominatimAddress; name?: string };
	if (!result.address) return null;
	return cityLabel(result.address, result.name ?? '');
}
