import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Place, LocationCoordinates, User } from '../types';
import { Navigation2, MapPin, Star, AlertTriangle, ShieldCheck, Search, Loader2, Plus, CheckCircle } from 'lucide-react';
import { addPlace } from '../services/store';

interface InteractiveMapProps {
  places: Place[];
  selectedPlace: Place | null;
  onSelectPlace: (place: Place) => void;
  userLocation: LocationCoordinates | null;
  currentUser?: User | null;
  onSelectLocationForNewPlace?: (coords: LocationCoordinates) => void;
  isPickingLocation?: boolean;
  onPlaceAdded?: (newPlace: Place) => void;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  places,
  selectedPlace,
  onSelectPlace,
  userLocation,
  currentUser,
  onSelectLocationForNewPlace,
  isPickingLocation = false,
  onPlaceAdded,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});

  // Search state for free OpenStreetMap Nominatim Geocoding
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [importedPlaces, setImportedPlaces] = useState<string[]>([]);

  const defaultCenter: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : [21.028511, 105.854167]; // Default Hanoi center

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
      }).setView(defaultCenter, 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // OpenStreetMap Nominatim search handler (100% Free - No API key needed)
  const handleSearchOSM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&limit=5&countrycodes=vn`
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
        if (data.length > 0 && mapInstanceRef.current) {
          const first = data[0];
          mapInstanceRef.current.flyTo([parseFloat(first.lat), parseFloat(first.lon)], 15);
        }
      }
    } catch (err) {
      console.error('Failed to search Nominatim OSM:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Add place from OSM search result
  const handleAddOsmPlace = async (item: any) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    const placeName = item.display_name.split(',')[0] || searchQuery;

    const newPlace = await addPlace({
      name: placeName,
      category: 'Địa điểm du lịch',
      address: item.display_name,
      phone: '',
      description: `Địa điểm được tìm thấy trên bản đồ OpenStreetMap. Tọa độ: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80',
      location: { lat, lng },
      addedBy: 'OpenStreetMap Sync',
    }, currentUser?.uid);

    setImportedPlaces((prev) => [...prev, item.place_id.toString()]);
    if (onPlaceAdded) onPlaceAdded(newPlace);
    onSelectPlace(newPlace);
    setSearchResults([]);
    setSearchQuery('');
  };

  // Handle Location Picker click
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (isPickingLocation && onSelectLocationForNewPlace) {
        onSelectLocationForNewPlace({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [isPickingLocation, onSelectLocationForNewPlace]);

  // Update Markers when places change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old place markers
    Object.values(markersRef.current).forEach((m: L.Marker) => m.remove());
    markersRef.current = {};

    places.forEach((place) => {
      const isSelected = selectedPlace?.placeId === place.placeId;

      // Custom HTML Marker Pin
      const iconHtml = `
        <div class="relative group cursor-pointer transition-transform duration-200 ${
          isSelected ? 'scale-125 z-50' : 'hover:scale-110'
        }">
          <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full shadow-lg border-2 text-xs font-bold whitespace-nowrap bg-white text-gray-900 border-amber-500">
            <span class="w-2 h-2 rounded-full ${
              (place.trustScore ?? 100) > 80 ? 'bg-emerald-500' : 'bg-amber-500'
            }"></span>
            <span>${place.name}</span>
            <span class="flex items-center text-amber-500 text-[10px]">
              ★ ${place.averageRating}
            </span>
          </div>
          <div class="w-3 h-3 bg-amber-500 rotate-45 mx-auto -mt-1.5 border-r border-b border-white"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-leaflet-marker',
        iconSize: [120, 40],
        iconAnchor: [60, 40],
      });

      const marker = L.marker([place.location.lat, place.location.lng], {
        icon: customIcon,
      }).addTo(map);

      marker.on('click', () => {
        onSelectPlace(place);
      });

      markersRef.current[place.placeId] = marker;
    });
  }, [places, selectedPlace, onSelectPlace]);

  // Update User Location Pin & Center map
  const userMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !userLocation) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    const userIconHtml = `
      <div class="relative flex items-center justify-center">
        <div class="w-5 h-5 bg-blue-600 rounded-full border-2 border-white shadow-md z-10"></div>
        <div class="absolute w-10 h-10 bg-blue-500/30 rounded-full animate-ping"></div>
      </div>
    `;

    const userIcon = L.divIcon({
      html: userIconHtml,
      className: 'user-location-marker',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    const marker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(map);
    userMarkerRef.current = marker;

    if (!selectedPlace) {
      map.flyTo([userLocation.lat, userLocation.lng], 14, {
        duration: 1.2,
      });
    }
  }, [userLocation]);

  // Center map on selected place
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (selectedPlace) {
      map.flyTo([selectedPlace.location.lat, selectedPlace.location.lng], 15, {
        duration: 1.2,
      });
    }
  }, [selectedPlace]);

  const handleRecenter = () => {
    if (mapInstanceRef.current && userLocation) {
      mapInstanceRef.current.flyTo([userLocation.lat, userLocation.lng], 14);
    }
  };

  return (
    <div className="relative w-full h-full min-h-[500px] rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Free OpenStreetMap Search Bar */}
      <div className="absolute top-4 left-4 z-10 w-full max-w-sm space-y-2">
        <form
          onSubmit={handleSearchOSM}
          className="flex items-center gap-2 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md p-2 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800"
        >
          <Search className="w-4 h-4 text-gray-400 ml-2 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm địa điểm bất kỳ trên bản đồ..."
            className="flex-1 bg-transparent text-xs font-semibold focus:outline-none text-gray-900 dark:text-white px-1"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0"
          >
            {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Tìm địa điểm'}
          </button>
        </form>

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-2.5 space-y-2 max-h-72 overflow-y-auto">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">
              Kết quả tìm kiếm bản đồ OpenStreetMap ({searchResults.length})
            </div>
            {searchResults.map((res, idx) => {
              const isAdded = importedPlaces.includes(res.place_id.toString());
              return (
                <div
                  key={idx}
                  className="p-2 rounded-xl bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-800 transition flex items-center justify-between gap-2"
                >
                  <div className="space-y-0.5 overflow-hidden flex-1">
                    <div className="font-bold text-xs text-gray-900 dark:text-white truncate">
                      {res.display_name.split(',')[0]}
                    </div>
                    <div className="text-[10px] text-gray-500 truncate">{res.display_name}</div>
                  </div>

                  <button
                    onClick={() => handleAddOsmPlace(res)}
                    disabled={isAdded}
                    className={`px-2 py-1 rounded-lg text-xs font-bold shrink-0 transition flex items-center gap-1 ${
                      isAdded
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-orange-600 text-white hover:bg-orange-700 shadow'
                    }`}
                  >
                    {isAdded ? (
                      <>
                        <CheckCircle className="w-3 h-3" />
                        <span>Đã thêm</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3 h-3" />
                        <span>Thêm địa điểm</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Picking Location Overlay Banner */}
      {isPickingLocation && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-amber-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-semibold flex items-center gap-2 animate-bounce">
          <MapPin className="w-4 h-4" />
          Nhấp chọn một vị trí trên bản đồ để thêm địa điểm mới
        </div>
      )}

      {/* Recenter button */}
      {userLocation && (
        <button
          onClick={handleRecenter}
          className="absolute bottom-6 left-6 z-10 p-3 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center gap-2 font-medium text-xs"
          title="Về vị trí hiện tại"
        >
          <Navigation2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Vị trí của tôi</span>
        </button>
      )}

      {/* Map Anti-Seeding Trust Legend */}
      <div className="absolute top-4 right-4 z-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md p-3 rounded-xl shadow-md border border-gray-200/80 dark:border-gray-800 text-xs space-y-1.5">
        <div className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Chỉ số AI Anti-Seeding</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span>Tin cậy cao (&gt;80%)</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          <span>Đang kiểm duyệt / Có cờ</span>
        </div>
      </div>
    </div>
  );
};

