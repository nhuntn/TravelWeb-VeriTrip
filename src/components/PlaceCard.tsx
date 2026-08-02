import React from 'react';
import { Place, LocationCoordinates } from '../types';
import { Star, MapPin, ShieldCheck, AlertTriangle, ArrowRight, Phone, ExternalLink, Navigation } from 'lucide-react';

interface PlaceCardProps {
  place: Place;
  userLocation: LocationCoordinates | null;
  onSelect: (place: Place) => void;
}

// Calculate distance in kilometers
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

export const PlaceCard: React.FC<PlaceCardProps> = ({ place, userLocation, onSelect }) => {
  const distance = userLocation
    ? getDistanceKm(userLocation.lat, userLocation.lng, place.location.lat, place.location.lng)
    : null;

  const trustScore = place.trustScore ?? 100;
  const isHighTrust = trustScore >= 80;

  return (
    <div
      onClick={() => onSelect(place)}
      className="group bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/80 dark:border-gray-800 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col justify-between cursor-pointer hover:-translate-y-1"
    >
      <div>
        {/* Image & Badges */}
        <div className="relative h-48 w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
          <img
            src={place.imageUrl}
            alt={place.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

          {/* Category Badge */}
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold bg-black/60 backdrop-blur-md text-white border border-white/20">
            {place.category}
          </span>

          {/* AI Anti-Seeding Trust Score Badge */}
          <div
            className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold backdrop-blur-md flex items-center gap-1 border shadow-sm ${
              isHighTrust
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
            }`}
            title="Độ tin cậy được tính toán từ các đánh giá thật (loại bỏ seeding)"
          >
            {isHighTrust ? (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>AI Trust: {trustScore}%</span>
          </div>

          {/* Distance Tag */}
          {distance !== null && (
            <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/90 dark:bg-gray-900/90 text-gray-900 dark:text-gray-100 backdrop-blur-md shadow-sm flex items-center gap-1">
              <MapPin className="w-3 h-3 text-orange-500" />
              <span>Cách bạn {distance} km</span>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-base text-gray-900 dark:text-white line-clamp-1 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
              {place.name}
            </h3>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-bold text-xs shrink-0 border border-amber-200 dark:border-amber-900">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>{place.reviewCount > 0 ? place.averageRating : '?'}</span>
              <span className="text-[10px] font-normal text-gray-500 dark:text-gray-400">({place.reviewCount})</span>
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
            <span className="truncate">{place.address}</span>
          </p>

          <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed">
            {place.description}
          </p>
        </div>
      </div>

      {/* Footer Action */}
      <div className="p-4 pt-0">
        <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400 group-hover:translate-x-1 transition-transform">
            <span>Chi tiết & Tóm tắt AI</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>

          <a
            href={
              place.googleMapsUrl ||
              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((place.name + ' ' + place.address).trim())}`
            }
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 hover:bg-orange-600 hover:text-white dark:hover:bg-orange-600 dark:hover:text-white transition flex items-center gap-1 text-[11px] font-bold border border-orange-200 dark:border-orange-800/60"
            title="Mở trực tiếp trên Google Maps"
          >
            <Navigation className="w-3 h-3" />
            <span>Maps</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
