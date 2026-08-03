import { LocationCoordinates } from '../types';

/**
 * Extracts geographical coordinates (lat, lng) from various Google Maps URL formats or raw coordinate strings.
 */
export function parseCoordsFromGoogleMapsUrl(url: string): LocationCoordinates | null {
  if (!url || typeof url !== 'string') return null;

  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    // 1. Check for place pin exact coordinates in data params (!3d15.3405!4d108.9212)
    const pinMatch = trimmed.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (pinMatch) {
      const lat = parseFloat(pinMatch[1]);
      const lng = parseFloat(pinMatch[2]);
      if (isValidLatLng(lat, lng)) return { lat, lng };
    }

    // 2. Check for @lat,lng format (@15.3405,108.9212)
    const atMatch = trimmed.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) {
      const lat = parseFloat(atMatch[1]);
      const lng = parseFloat(atMatch[2]);
      if (isValidLatLng(lat, lng)) return { lat, lng };
    }

    // 3. Check for query parameters: q=, query=, ll=, destination=, center=, point=, near=, sll=, cbll=
    const qMatch = trimmed.match(/(?:q|query|ll|destination|center|point|near|sll|cbll)=(-?\d+\.\d+)(?:,|\+|\s)+(-?\d+\.\d+)/i);
    if (qMatch) {
      const lat = parseFloat(qMatch[1]);
      const lng = parseFloat(qMatch[2]);
      if (isValidLatLng(lat, lng)) return { lat, lng };
    }

    // 4. Check for path patterns: /search/15.3405,108.9212 or /place/15.3405,108.9212 or /dir/15.3405,108.9212
    const pathMatch = trimmed.match(/(?:search|place|dir|maps)\/(-?\d+\.\d+)(?:,|\+|\s)+(-?\d+\.\d+)/i);
    if (pathMatch) {
      const lat = parseFloat(pathMatch[1]);
      const lng = parseFloat(pathMatch[2]);
      if (isValidLatLng(lat, lng)) return { lat, lng };
    }

    // 5. Check if user pasted raw coordinates like "15.3405, 108.9212" or "15.3405,108.9212"
    const rawMatch = trimmed.match(/^@?(-?\d+\.\d+)(?:,|\+|\s)+(-?\d+\.\d+)$/);
    if (rawMatch) {
      const lat = parseFloat(rawMatch[1]);
      const lng = parseFloat(rawMatch[2]);
      if (isValidLatLng(lat, lng)) return { lat, lng };
    }
  } catch (err) {
    console.warn('Error parsing Google Maps coordinates:', err);
  }

  return null;
}

function isValidLatLng(lat: number, lng: number): boolean {
  return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}
