import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocationCoordinates } from '../types';
import { X, MapPin, Check, Loader2, Navigation, Compass } from 'lucide-react';

interface MapLocationPickerProps {
  initialCoords: LocationCoordinates;
  onConfirmLocation: (coords: LocationCoordinates, address: string) => void;
  onClose: () => void;
}

export const MapLocationPicker: React.FC<MapLocationPickerProps> = ({
  initialCoords,
  onConfirmLocation,
  onClose,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [selectedCoords, setSelectedCoords] = useState<LocationCoordinates>(initialCoords);
  const [address, setAddress] = useState<string>('');
  const [isLoadingAddress, setIsLoadingAddress] = useState<boolean>(false);

  // Reverse geocode lat/lng to address string via OpenStreetMap Nominatim
  const fetchAddress = async (coords: LocationCoordinates) => {
    setIsLoadingAddress(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}&accept-language=vi`
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          setAddress(data.display_name);
        } else {
          setAddress(`Tọa độ (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`);
        }
      }
    } catch (err) {
      console.error('Lỗi lấy địa chỉ:', err);
      setAddress(`Tọa độ (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`);
    } finally {
      setIsLoadingAddress(false);
    }
  };

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
      }).setView([initialCoords.lat, initialCoords.lng], 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      mapInstanceRef.current = map;

      // Custom Pin Icon
      const pinIcon = L.divIcon({
        html: `
          <div class="relative flex flex-col items-center">
            <div class="w-9 h-9 bg-orange-600 text-white rounded-full border-2 border-white shadow-2xl flex items-center justify-center animate-bounce">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <div class="w-3 h-3 bg-orange-600 rotate-45 -mt-1.5 border-r border-b border-white"></div>
          </div>
        `,
        className: 'custom-map-picker-marker',
        iconSize: [36, 44],
        iconAnchor: [18, 44],
      });

      // Initial marker
      const marker = L.marker([initialCoords.lat, initialCoords.lng], {
        icon: pinIcon,
        draggable: true,
      }).addTo(map);

      markerRef.current = marker;

      // Handle marker drag
      marker.on('dragend', () => {
        const latLng = marker.getLatLng();
        const newCoords = { lat: latLng.lat, lng: latLng.lng };
        setSelectedCoords(newCoords);
        fetchAddress(newCoords);
      });

      // Handle click on map to move marker
      map.on('click', (e: L.LeafletMouseEvent) => {
        const newCoords = { lat: e.latlng.lat, lng: e.latlng.lng };
        setSelectedCoords(newCoords);
        if (markerRef.current) {
          markerRef.current.setLatLng([e.latlng.lat, e.latlng.lng]);
        }
        fetchAddress(newCoords);
      });

      // Invalidate size to ensure proper tile rendering inside modal
      setTimeout(() => {
        map.invalidateSize();
      }, 200);

      fetchAddress(initialCoords);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Recenter to user's current GPS location
  const handleGetCurrentGps = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setSelectedCoords(newCoords);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([newCoords.lat, newCoords.lng], 16);
        }
        if (markerRef.current) {
          markerRef.current.setLatLng([newCoords.lat, newCoords.lng]);
        }
        fetchAddress(newCoords);
      },
      (err) => alert('Không thể lấy vị trí GPS: ' + err.message)
    );
  };

  const handleConfirm = () => {
    onConfirmLocation(selectedCoords, address);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 md:p-5 bg-black/80 backdrop-blur-md cursor-pointer"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-2xl h-[85vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-800 relative overflow-hidden my-auto cursor-default animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0 bg-white dark:bg-gray-900 z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-orange-100 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400 rounded-xl">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm md:text-base text-gray-900 dark:text-white">
                Chọn vị trí trên bản đồ
              </h3>
              <p className="text-[11px] text-gray-500">
                Nhấp chuột vào vị trí bất kỳ trên bản đồ để ghim địa điểm
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Map Area */}
        <div className="relative flex-1 w-full h-full bg-gray-100 dark:bg-gray-950">
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* Quick GPS Recenter Button */}
          <button
            type="button"
            onClick={handleGetCurrentGps}
            className="absolute bottom-24 left-4 z-10 p-2.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center gap-1.5 text-xs font-semibold"
            title="Vị trí GPS của tôi"
          >
            <Navigation className="w-4 h-4 text-orange-600" />
            <span className="hidden sm:inline">Vị trí GPS</span>
          </button>
        </div>

        {/* Bottom Location Confirmation Bar */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 z-10 shrink-0 space-y-3">
          <div className="p-3 bg-orange-50 dark:bg-orange-950/40 rounded-2xl border border-orange-200 dark:border-orange-800/60 flex items-start gap-2.5">
            <MapPin className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs space-y-0.5">
              <div className="font-bold text-gray-900 dark:text-white flex items-center justify-between">
                <span>Vị trí đã chọn</span>
                <span className="text-[10px] text-gray-500 font-mono">
                  {selectedCoords.lat.toFixed(5)}, {selectedCoords.lng.toFixed(5)}
                </span>
              </div>
              <div className="text-gray-600 dark:text-gray-300 font-medium line-clamp-2">
                {isLoadingAddress ? (
                  <span className="flex items-center gap-1.5 text-orange-600">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Đang tìm địa chỉ từ tọa độ...
                  </span>
                ) : (
                  address || 'Đang xác định địa chỉ...'
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold text-xs hover:bg-gray-200 transition"
            >
              Hủy
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-lg shadow-orange-600/20 transition flex items-center gap-1.5 active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>Chọn vị trí này</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
