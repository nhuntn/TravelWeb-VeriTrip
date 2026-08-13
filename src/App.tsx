import React, { useState, useEffect } from 'react';
import { Place, Review, User, LocationCoordinates } from './types';
import { supabase } from './services/supabaseClient';
import {
  getPlaces,
  getReviews,
  getCurrentUser,
  setCurrentUserId,
  logoutUser,
  resetDemoData,
} from './services/store';
import { Navbar } from './components/Navbar';
import { InteractiveMap } from './components/InteractiveMap';
import { GoogleMapsView } from './components/GoogleMapsView';
import { PlaceList } from './components/PlaceList';
import { PlaceDetailModal } from './components/PlaceDetailModal';
import { AddPlaceModal } from './components/AddPlaceModal';
import { EditPlaceModal } from './components/EditPlaceModal';
import { UserStatusModal } from './components/UserStatusModal';
import { AuthModal } from './components/AuthModal';
import {
  MapPin,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Compass,
  Building2,
  ListFilter,
  Map as MapIcon,
  Smartphone,
  Navigation,
  AlertTriangle,
} from 'lucide-react';

export default function App() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [mapEngine, setMapEngine] = useState<'google' | 'leaflet'>('leaflet');

  // Modals
  const [isAddPlaceOpen, setIsAddPlaceOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [isUserStatusOpen, setIsUserStatusOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pickedMapCoords, setPickedMapCoords] = useState<LocationCoordinates | null>(null);

  // User location & city selection
  const [userLocation, setUserLocation] = useState<LocationCoordinates | null>({
    lat: 15.3405,
    lng: 108.9212, // Default Quảng Ngãi (Bình Sơn)
  });
  const [locationName, setLocationName] = useState('Quảng Ngãi (Bình Sơn)');

  // Load initial store data
  useEffect(() => {
    reloadStoreData();
    requestBrowserGeolocation();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        const user = await getCurrentUser();
        setCurrentUser(user);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const reloadStoreData = async () => {
    try {
      const [fetchedPlaces, fetchedReviews, fetchedUser] = await Promise.all([
        getPlaces(),
        getReviews(),
        getCurrentUser(),
      ]);
      setPlaces(fetchedPlaces);
      setReviews(fetchedReviews);
      setCurrentUser(fetchedUser);
    } catch (err) {
      console.error('Error loading store data:', err);
    }
  };

  // Browser Geolocation API
  const requestBrowserGeolocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setSelectedPlace(null);
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setLocationName('Vị trí hiện tại');
        },
        (err) => {
          console.log('Using default location:', err.message);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  };

  // City presets switcher
  const setCityLocation = (cityName: string, coords: LocationCoordinates) => {
    setSelectedPlace(null);
    setUserLocation(coords);
    setLocationName(cityName);
  };

  const handleSwitchUser = async (uid: string) => {
    await setCurrentUserId(uid);
    const user = await getCurrentUser();
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    await logoutUser();
    await reloadStoreData();
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    reloadStoreData();
    setIsAuthModalOpen(false);
    setIsUserStatusOpen(true);
  };

  const handleResetData = async () => {
    await resetDemoData();
    await reloadStoreData();
  };

  const selectedPlaceReviews = selectedPlace
    ? reviews.filter((r) => r.placeId === selectedPlace.placeId)
    : [];

  // Handler to open Add Place modal (requires login)
  const handleOpenAddPlace = () => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
    } else {
      setIsAddPlaceOpen(true);
    }
  };

  // Quick handler to add place at current GPS location (requires login)
  const handleAddAtCurrentLocation = () => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(coords);
          setPickedMapCoords(coords);
          setIsAddPlaceOpen(true);
        },
        (err) => {
          console.warn('GPS error:', err);
          setIsAddPlaceOpen(true);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setIsAddPlaceOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      
      {/* Top Navbar */}
      <Navbar
        viewMode={viewMode}
        onViewChange={setViewMode}
        currentUser={currentUser}
        onOpenAddPlace={handleOpenAddPlace}
        onAddAtCurrentLocation={handleAddAtCurrentLocation}
        onOpenUserStatus={() => setIsUserStatusOpen(true)}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        onSwitchUser={handleSwitchUser}
        locationName={locationName}
        onRequestLocation={requestBrowserGeolocation}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* User Ban Warning Bar if user is currently banned */}
        {currentUser?.isBanned && (
          <div className="p-4 bg-rose-600 text-white rounded-2xl shadow-lg flex items-center justify-between gap-3 text-xs font-semibold">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>
                Tài khoản ({currentUser.username}) đã bị khóa do vi phạm &gt;5 lần quy định review seeding rác. Bạn có thể xem địa điểm nhưng không thể thêm địa điểm/review.
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 bg-white text-rose-800 rounded-xl font-bold shrink-0 hover:bg-rose-50 transition"
            >
              Đăng xuất
            </button>
          </div>
        )}

        {/* View Switching Layout */}
        {viewMode === 'map' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Interactive Map View */}
            <div className="lg:col-span-8 h-[600px] lg:h-[720px] sticky top-20 flex flex-col space-y-2">
              {/* Map Engine Render */}
              <div className="flex-1 w-full h-full min-h-[550px] overflow-hidden rounded-2xl">
                {mapEngine === 'google' ? (
                  <GoogleMapsView
                    places={places}
                    selectedPlace={selectedPlace}
                    onSelectPlace={(p) => setSelectedPlace(p)}
                    userLocation={userLocation}
                    currentUser={currentUser}
                    onPlaceAdded={() => reloadStoreData()}
                  />
                ) : (
                  <InteractiveMap
                    places={places}
                    selectedPlace={selectedPlace}
                    onSelectPlace={(p) => setSelectedPlace(p)}
                    userLocation={userLocation}
                    currentUser={currentUser}
                    onPlaceAdded={() => reloadStoreData()}
                  />
                )}
              </div>
            </div>

            {/* Side List for Quick Place Discovery */}
            <div className="lg:col-span-4 space-y-4 max-h-[720px] overflow-y-auto pr-1">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                  Địa điểm lân cận
                  <span className="text-xs font-normal text-gray-500">({places.length})</span>
                </h2>
                <button
                  onClick={() => setViewMode('list')}
                  className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline"
                >
                  Xem dạng danh sách →
                </button>
              </div>

              <div className="space-y-3">
                {places.map((place) => (
                  <div
                    key={place.placeId}
                    onClick={() => setSelectedPlace(place)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex gap-3.5 items-center ${
                      selectedPlace?.placeId === place.placeId
                        ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-500 shadow-md scale-[1.02]'
                        : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300'
                    }`}
                  >
                    <img
                      src={place.imageUrl}
                      alt={place.name}
                      className="w-20 h-20 rounded-xl object-cover shrink-0"
                    />
                    <div className="space-y-1 overflow-hidden flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                          {place.category}
                        </span>
                        <span className="text-xs font-bold text-amber-500">
                          ★ {place.averageRating}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                        {place.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {place.address}
                      </p>
                      <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        <span>AI Trust: {place.trustScore ?? 100}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        ) : (
          /* List View Mode */
          <PlaceList
            places={places}
            userLocation={userLocation}
            currentUser={currentUser}
            onSelectPlace={(p) => setSelectedPlace(p)}
            onEditPlace={(p) => setEditingPlace(p)}
          />
        )}
      </main>

      {/* Place Detail Modal */}
      {selectedPlace && (
        <PlaceDetailModal
          place={selectedPlace}
          reviews={selectedPlaceReviews}
          currentUser={currentUser}
          onClose={() => setSelectedPlace(null)}
          onReviewSubmitted={reloadStoreData}
          onSwitchUser={handleSwitchUser}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onEditPlace={(p) => setEditingPlace(p)}
        />
      )}

      {/* Add Place Modal */}
      {isAddPlaceOpen && (
        <AddPlaceModal
          userLocation={userLocation}
          pickedCoordinates={pickedMapCoords}
          currentUser={currentUser}
          onClose={() => setIsAddPlaceOpen(false)}
          onPlaceAdded={(newPlace) => {
            reloadStoreData();
            setSelectedPlace(newPlace);
          }}
        />
      )}

      {/* Edit Place Modal */}
      {editingPlace && (
        <EditPlaceModal
          place={editingPlace}
          userLocation={userLocation}
          currentUser={currentUser}
          onClose={() => setEditingPlace(null)}
          onPlaceUpdated={(updatedPlace) => {
            reloadStoreData();
            if (selectedPlace && selectedPlace.placeId === updatedPlace.placeId) {
              setSelectedPlace(updatedPlace);
            }
          }}
        />
      )}

      {/* User Status Modal */}
      {isUserStatusOpen && (
        <UserStatusModal
          user={currentUser}
          places={places}
          reviews={reviews}
          onClose={() => setIsUserStatusOpen(false)}
          onSwitchUser={handleSwitchUser}
          onResetData={handleResetData}
          onLogout={handleLogout}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onUpdateUser={reloadStoreData}
        />
      )}

      {/* Auth Modal (Login / Register) */}
      {isAuthModalOpen && (
        <AuthModal
          onClose={() => setIsAuthModalOpen(false)}
          onLoginSuccess={handleLoginSuccess}
        />
      )}

      {/* Footer */}
      <footer className="mt-auto border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 py-6 text-center text-xs text-gray-500 space-y-1">
        <p className="font-medium text-gray-700 dark:text-gray-300">
          VeriTrip © 2026 — Nền Tảng Du Lịch & Địa Điểm Ăn Uống Thông Minh Tích Hợp AI Anti-Seeding
        </p>
        <p>Phát triển bằng React, Vite, Express, Supabase & Google Gemini AI Anti-Seeding</p>
      </footer>

    </div>
  );
}
