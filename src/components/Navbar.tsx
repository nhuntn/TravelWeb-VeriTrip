import React from 'react';
import { User } from '../types';
import {
  Compass,
  Map,
  ListFilter,
  PlusCircle,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  LogOut,
  Sparkles,
  MapPin,
  Smartphone,
} from 'lucide-react';

interface NavbarProps {
  viewMode: 'map' | 'list';
  onViewChange: (mode: 'map' | 'list') => void;
  currentUser: User | null;
  onOpenAddPlace: () => void;
  onAddAtCurrentLocation?: () => void;
  onOpenUserStatus: () => void;
  onSwitchUser: (uid: string) => void;
  locationName: string;
  onRequestLocation: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  viewMode,
  onViewChange,
  currentUser,
  onOpenAddPlace,
  onAddAtCurrentLocation,
  onOpenUserStatus,
  onSwitchUser,
  locationName,
  onRequestLocation,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* Brand Logo & Tagline */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
            <Compass className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg text-gray-900 dark:text-white tracking-tight">
                Travel<span className="text-orange-600 dark:text-orange-400">Web</span>
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 border border-orange-200 dark:border-orange-800 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> Anti-Seeding AI
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
              Địa điểm chân thực • Cảnh báo đánh giá ảo
            </p>
          </div>
        </div>

        {/* Location & Mode Switcher */}
        <div className="flex items-center gap-2">
          {/* Location Center Button */}
          <button
            onClick={onRequestLocation}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 dark:bg-orange-950/60 text-xs text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/60 transition border border-orange-200 dark:border-orange-800/80 font-bold shadow-sm active:scale-95"
            title="Đưa bản đồ về vị trí GPS hiện tại của tôi"
          >
            <Compass className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
            <span className="truncate max-w-[120px] sm:max-w-[150px]">{locationName}</span>
          </button>

          {/* View Toggle Buttons */}
          <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-xl flex items-center border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => onViewChange('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'map'
                  ? 'bg-white dark:bg-gray-900 text-orange-600 dark:text-orange-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              <span>Bản đồ</span>
            </button>
            <button
              onClick={() => onViewChange('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-gray-900 text-orange-600 dark:text-orange-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Danh sách</span>
            </button>
          </div>
        </div>

        {/* Actions & User Profile */}
        <div className="flex items-center gap-2">
          {/* Add Place Button */}
          <button
            onClick={onOpenAddPlace}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-medium text-xs shadow-md shadow-orange-600/20 transition active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Thêm địa điểm mới</span>
          </button>

          {/* User Profile / Switcher Dropdown */}
          {currentUser ? (
            <div className="relative group">
              <button
                onClick={onOpenUserStatus}
                className="flex items-center gap-2 p-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition border border-gray-200 dark:border-gray-700"
              >
                <img
                  src={currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                  alt={currentUser.username}
                  className="w-7 h-7 rounded-lg object-cover"
                />
                <div className="hidden lg:block text-left pr-1">
                  <div className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[120px]">
                    {currentUser.username}
                  </div>
                  <div className="text-[10px] flex items-center gap-1">
                    {currentUser.isBanned ? (
                      <span className="text-red-500 font-bold flex items-center gap-0.5">
                        <ShieldAlert className="w-2.5 h-2.5" /> Đã Bị Khóa
                      </span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
                        <ShieldCheck className="w-2.5 h-2.5" /> Strikes: {currentUser.strikes}/5
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </div>
          ) : (
            <button
              onClick={() => onSwitchUser('user_demo_1')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-semibold text-xs transition hover:opacity-90"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Đăng nhập Gmail</span>
            </button>
          )}



        </div>
      </div>
    </header>
  );
};
