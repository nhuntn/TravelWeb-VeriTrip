import React, { useState } from 'react';
import { Place, LocationCoordinates } from '../types';
import { PlaceCard } from './PlaceCard';
import { Search, SlidersHorizontal, Sparkles, MapPin, Building2, Utensils, Coffee, Pizza, Ticket } from 'lucide-react';

interface PlaceListProps {
  places: Place[];
  userLocation: LocationCoordinates | null;
  onSelectPlace: (place: Place) => void;
  onEditPlace?: (place: Place) => void;
}

const CATEGORIES = [
  { id: 'ALL', label: 'Tất cả', icon: Building2 },
  { id: 'Nhà hàng', label: 'Nhà hàng', icon: Utensils },
  { id: 'Quán cafe', label: 'Quán cafe', icon: Coffee },
  { id: 'Ăn vặt', label: 'Ăn vặt', icon: Pizza },
  { id: 'Vui chơi', label: 'Vui chơi', icon: Ticket },
];

export const PlaceList: React.FC<PlaceListProps> = ({ places, userLocation, onSelectPlace, onEditPlace }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [sortBy, setSortBy] = useState<'trust' | 'rating' | 'distance'>('trust');

  // Filter & Sort
  const filteredPlaces = places
    .filter((place) => {
      const matchesSearch =
        place.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        place.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        place.description.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory = selectedCategory === 'ALL' || place.category === selectedCategory;

      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === 'trust') {
        return (b.trustScore ?? 100) - (a.trustScore ?? 100);
      }
      if (sortBy === 'rating') {
        return b.averageRating - a.averageRating;
      }
      if (sortBy === 'distance' && userLocation) {
        const distA = Math.hypot(a.location.lat - userLocation.lat, a.location.lng - userLocation.lng);
        const distB = Math.hypot(b.location.lat - userLocation.lat, b.location.lng - userLocation.lng);
        return distA - distB;
      }
      return 0;
    });

  return (
    <div className="space-y-6">
      {/* Search & Filter Header */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm địa điểm, món ăn, địa chỉ..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
            />
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <SlidersHorizontal className="w-4 h-4 text-gray-400 hidden sm:block" />
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="trust">Xếp theo: AI Trust (Độ tin cậy)</option>
              <option value="rating">Xếp theo: Đánh giá cao nhất</option>
              {userLocation && <option value="distance">Xếp theo: Khoảng cách gần nhất</option>}
            </select>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-orange-600 text-white shadow-md shadow-orange-600/20 scale-105'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid List Results */}
      {filteredPlaces.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlaces.map((place) => (
            <PlaceCard
              key={place.placeId}
              place={place}
              userLocation={userLocation}
              onSelect={onSelectPlace}
              onEdit={onEditPlace}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-12 text-center border border-gray-200 dark:border-gray-800 space-y-3">
          <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Không tìm thấy địa điểm</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Thử thay đổi từ khóa tìm kiếm hoặc chọn danh mục khác để khám phá thêm địa điểm du lịch & ăn uống.
          </p>
        </div>
      )}
    </div>
  );
};
