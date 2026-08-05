import React, { useState, useEffect } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap,
  useMapsLibrary,
  useAdvancedMarkerRef,
} from '@vis.gl/react-google-maps';
import { Place, LocationCoordinates, User } from '../types';
import { addPlace } from '../services/store';
import {
  Search,
  MapPin,
  Star,
  ShieldCheck,
  Plus,
  Compass,
  Navigation,
  Key,
  ExternalLink,
  Sparkles,
  Loader2,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

interface GoogleMapsViewProps {
  places: Place[];
  selectedPlace: Place | null;
  onSelectPlace: (place: Place) => void;
  userLocation: LocationCoordinates | null;
  currentUser?: User | null;
  onPlaceAdded?: (newPlace: Place) => void;
}

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

// Inner component for Google Places Search Bar
function PlacesSearchBar({
  onImportPlace,
  currentUserUid,
}: {
  onImportPlace: (placeData: any) => void;
  currentUserUid?: string;
}) {
  const placesLib = useMapsLibrary('places');
  const map = useMap();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [importedIds, setImportedIds] = useState<string[]>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placesLib || !query.trim()) return;

    setIsSearching(true);
    try {
      const response = await placesLib.Place.searchByText({
        textQuery: query,
        fields: [
          'displayName',
          'location',
          'formattedAddress',
          'rating',
          'userRatingCount',
          'photos',
          'nationalPhoneNumber',
        ],
        locationBias: map?.getCenter(),
        maxResultCount: 6,
      });

      if (response && response.places) {
        setSearchResults(response.places);
        if (response.places.length > 0 && response.places[0].location && map) {
          map.panTo(response.places[0].location);
        }
      }
    } catch (err) {
      console.error('Search places error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleImport = async (googlePlace: any) => {
    let imageUrl =
      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80';

    if (googlePlace.photos && googlePlace.photos.length > 0) {
      try {
        imageUrl = googlePlace.photos[0].getURI({ maxWidth: 600 });
      } catch (e) {
        console.log('Error getting photo URI:', e);
      }
    }

    const lat = typeof googlePlace.location?.lat === 'function' ? googlePlace.location.lat() : googlePlace.location?.lat || 21.0285;
    const lng = typeof googlePlace.location?.lng === 'function' ? googlePlace.location.lng() : googlePlace.location?.lng || 105.854;

    const newPlace = await addPlace({
      name: typeof googlePlace.displayName === 'string' ? googlePlace.displayName : googlePlace.displayName?.text || 'Địa điểm Google Maps',
      category: 'Nhà hàng',
      address: googlePlace.formattedAddress || 'Địa chỉ từ Google Maps',
      phone: googlePlace.nationalPhoneNumber || '',
      description: `Địa điểm được đồng bộ trực tiếp từ Google Maps API (${googlePlace.rating || '4.5'}★)`,
      imageUrl,
      location: { lat, lng },
      addedBy: 'Google Maps API Sync',
    }, currentUserUid);

    setImportedIds((prev) => [...prev, googlePlace.id || newPlace.placeId]);
    onImportPlace(newPlace);
  };

  return (
    <div className="absolute top-4 left-4 z-10 w-full max-w-md space-y-2">
      <form onSubmit={handleSearch} className="flex items-center gap-2 bg-white dark:bg-gray-900 p-2 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800">
        <Search className="w-4 h-4 text-gray-400 ml-2 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm địa điểm bất kỳ trên Google Maps..."
          className="flex-1 bg-transparent text-xs font-semibold focus:outline-none text-gray-900 dark:text-white px-2"
        />
        <button
          type="submit"
          disabled={isSearching}
          className="px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0"
        >
          {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Tìm Google Map'}
        </button>
      </form>

      {/* Results Dropdown */}
      {searchResults.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-3 space-y-2 max-h-80 overflow-y-auto">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">
            Kết quả từ Google Maps Places ({searchResults.length})
          </div>
          {searchResults.map((item, idx) => {
            const isImported = importedIds.includes(item.id);
            const name = typeof item.displayName === 'string' ? item.displayName : item.displayName?.text || 'Địa điểm';
            return (
              <div
                key={idx}
                className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-800 transition flex items-center justify-between gap-2"
              >
                <div className="space-y-0.5 overflow-hidden flex-1">
                  <div className="font-bold text-xs text-gray-900 dark:text-white truncate">
                    {name}
                  </div>
                  <div className="text-[11px] text-gray-500 truncate">{item.formattedAddress}</div>
                  {item.rating && (
                    <div className="text-[10px] font-bold text-amber-500 flex items-center gap-1">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>{item.rating} ({item.userRatingCount || 0} đánh giá)</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleImport(item)}
                  disabled={isImported}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold shrink-0 transition flex items-center gap-1 ${
                    isImported
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-orange-600 text-white hover:bg-orange-700 shadow'
                  }`}
                >
                  {isImported ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Đã đồng bộ</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Đồng bộ</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Marker component using AdvancedMarker
function GoogleMapMarker({
  place,
  isSelected,
  onSelect,
}: {
  key?: string;
  place: Place;
  isSelected: boolean;
  onSelect: (place: Place) => void;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: place.location.lat, lng: place.location.lng }}
        onClick={() => {
          onSelect(place);
          setInfoOpen(true);
        }}
        title={place.name}
      >
        <Pin
          background={isSelected ? '#ea580c' : (place.trustScore ?? 100) > 80 ? '#10b981' : '#f59e0b'}
          glyphColor="#ffffff"
          borderColor="#ffffff"
        />
      </AdvancedMarker>

      {infoOpen && (
        <InfoWindow anchor={marker} onCloseClick={() => setInfoOpen(false)}>
          <div className="p-2 space-y-1 max-w-xs text-gray-900">
            <div className="font-bold text-sm text-gray-900">{place.name}</div>
            <div className="text-xs text-gray-600 line-clamp-1">{place.address}</div>
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="font-bold text-amber-600">★ {place.averageRating}</span>
              <span className="text-[10px] font-bold text-emerald-600">AI Trust: {place.trustScore ?? 100}%</span>
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

// Inner component to handle panning map to center
function MapCenterHandler({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    if (map && center) {
      map.panTo(center);
    }
  }, [map, center.lat, center.lng]);
  return null;
}

export const GoogleMapsView: React.FC<GoogleMapsViewProps> = ({
  places,
  selectedPlace,
  onSelectPlace,
  userLocation,
  currentUser,
  onPlaceAdded,
}) => {
  const center = userLocation
    ? { lat: userLocation.lat, lng: userLocation.lng }
    : { lat: 21.028511, lng: 105.854167 };

  // Splash Screen if no key provided
  if (!hasValidKey) {
    return (
      <div className="w-full h-full min-h-[550px] rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white p-8 flex flex-col items-center justify-center text-center space-y-6 border border-gray-800 shadow-xl">
        <div className="p-4 bg-orange-600/20 border border-orange-500/40 rounded-3xl text-orange-400">
          <Key className="w-10 h-10 animate-pulse" />
        </div>

        <div className="space-y-2 max-w-lg">
          <h2 className="text-2xl font-extrabold text-white">Yêu cầu Google Maps API Key</h2>
          <p className="text-xs text-gray-300 leading-relaxed">
            Để hiển thị và đồng bộ toàn bộ địa điểm trực tiếp từ Google Maps Platform, bạn cần cấu hình environment variable <code className="bg-black/60 px-2 py-0.5 rounded text-orange-300 font-mono">GOOGLE_MAPS_PLATFORM_KEY</code>.
          </p>
        </div>

        <div className="bg-black/40 p-5 rounded-2xl text-left text-xs space-y-2 max-w-md border border-white/10">
          <div className="font-bold text-orange-400 uppercase tracking-wider text-[11px]">
            Hướng dẫn kích hoạt Google Maps:
          </div>
          <ol className="list-decimal list-inside space-y-1.5 text-gray-300">
            <li>
              Lấy API Key miễn phí từ{' '}
              <a
                href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-400 underline font-bold"
              >
                Google Cloud Console
              </a>
            </li>
            <li>
              Mở <strong>Settings (⚙️)</strong> góc trên bên phải → <strong>Secrets</strong>
            </li>
            <li>
              Nhập tên secret: <code className="text-amber-300 font-mono">GOOGLE_MAPS_PLATFORM_KEY</code>
            </li>
            <li>Dán API Key vừa tạo và bấm Enter</li>
          </ol>
        </div>

        <div className="text-xs text-gray-400 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Ứng dụng sẽ tự động kích hoạt ngay sau khi lưu Secret.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[600px] rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-md">
      <APIProvider apiKey={API_KEY} version="weekly">
        {/* Google Places Live Search Bar */}
        <PlacesSearchBar
          currentUserUid={currentUser?.uid}
          onImportPlace={(p) => {
            if (onPlaceAdded) onPlaceAdded(p);
          }}
        />

        {/* Google Map */}
        <Map
          defaultCenter={center}
          defaultZoom={13}
          mapId="DEMO_MAP_ID"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
        >
          <MapCenterHandler center={center} />
          {/* Places Markers */}
          {places.map((place) => (
            <GoogleMapMarker
              key={place.placeId}
              place={place}
              isSelected={selectedPlace?.placeId === place.placeId}
              onSelect={onSelectPlace}
            />
          ))}

          {/* User location pin */}
          {userLocation && (
            <AdvancedMarker position={{ lat: userLocation.lat, lng: userLocation.lng }}>
              <div className="relative flex items-center justify-center">
                <div className="w-5 h-5 bg-blue-600 rounded-full border-2 border-white shadow-md z-10" />
                <div className="absolute w-10 h-10 bg-blue-500/30 rounded-full animate-ping" />
              </div>
            </AdvancedMarker>
          )}
        </Map>
      </APIProvider>

      {/* Legend Badge */}
      <div className="absolute bottom-4 right-4 z-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md p-3 rounded-xl shadow-md border border-gray-200/80 dark:border-gray-800 text-xs space-y-1">
        <div className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Google Maps + AI Anti-Seeding</span>
        </div>
        <div className="text-[11px] text-gray-500">
          Tích hợp Google Maps Places API (New)
        </div>
      </div>
    </div>
  );
};
