import React, { useState, useEffect, useRef } from 'react';
import { LocationCoordinates, Place, User } from '../types';
import { addPlace } from '../services/store';
import { X, MapPin, PlusCircle, Image as ImageIcon, Building2, Phone, FileText, Compass, Loader2, Navigation, ExternalLink, Link2, Camera, Upload, Trash2, CameraOff, RefreshCw, Map as MapIcon } from 'lucide-react';
import { MapLocationPicker } from './MapLocationPicker';

interface AddPlaceModalProps {
  userLocation: LocationCoordinates | null;
  onClose: () => void;
  onPlaceAdded: (newPlace: Place) => void;
  pickedCoordinates?: LocationCoordinates | null;
  currentUser?: User | null;
}

const CATEGORIES = ['Thắng cảnh thiên nhiên', 'Bãi biển', 'Du lịch sinh thái', 'Làng văn hóa', 'Nhà hàng', 'Quán cafe', 'Ăn vặt', 'Vui chơi', 'Khách sạn / Homestay'];

export const AddPlaceModal: React.FC<AddPlaceModalProps> = ({
  userLocation,
  onClose,
  onPlaceAdded,
  pickedCoordinates,
  currentUser,
}) => {
  const defaultCoords = pickedCoordinates || userLocation || { lat: 15.3405, lng: 108.9212 };

  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [coords, setCoords] = useState<LocationCoordinates>(defaultCoords);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsSuccess, setGpsSuccess] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);

  const handleConfirmMapLocation = (pickedCoords: LocationCoordinates, pickedAddress: string) => {
    setCoords(pickedCoords);
    if (pickedAddress) {
      setAddress(pickedAddress);
    }
    setGpsSuccess(true);
  };

  // Camera & File upload state
  const [isLiveCameraActive, setIsLiveCameraActive] = useState(false);
  const [imageSourceType, setImageSourceType] = useState<'url' | 'upload' | 'camera'>('url');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  // Handle local file selection
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImageUrl(event.target.result as string);
          setImageSourceType('upload');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Start live webcam feed
  const startLiveCamera = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        setMediaStream(stream);
        setIsLiveCameraActive(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } else {
        // Fallback to camera file input on devices without getUserMedia
        cameraInputRef.current?.click();
      }
    } catch (err) {
      console.warn('Webcam stream unavailable, opening native camera picker:', err);
      // Native camera input trigger
      cameraInputRef.current?.click();
    }
  };

  // Capture snapshot from webcam video stream
  const captureSnapshot = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setImageUrl(dataUrl);
        setImageSourceType('camera');
        stopLiveCamera();
      }
    }
  };

  // Stop camera media stream
  const stopLiveCamera = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      setMediaStream(null);
    }
    setIsLiveCameraActive(false);
  };

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [mediaStream]);

  // Auto-reverse geocode address when modal opens with GPS or picked coordinates
  useEffect(() => {
    if ((pickedCoordinates || userLocation) && !address) {
      const targetCoords = pickedCoordinates || userLocation;
      if (targetCoords) {
        setIsLocating(true);
        fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${targetCoords.lat}&lon=${targetCoords.lng}&accept-language=vi`
        )
          .then((res) => res.json())
          .then((data) => {
            if (data && data.display_name) {
              setAddress(data.display_name);
              setGpsSuccess(true);
            }
          })
          .catch((err) => console.error('Lỗi tự động lấy địa chỉ GPS:', err))
          .finally(() => setIsLocating(false));
      }
    }
  }, [pickedCoordinates, userLocation]);

  // Helper to parse coordinates embedded in Google Maps URLs
  const parseCoordsFromGoogleMapsUrl = (url: string): LocationCoordinates | null => {
    try {
      const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (atMatch) {
        return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
      }
      const qMatch = url.match(/(?:q|query|ll|destination)=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (qMatch) {
        return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
      }
    } catch (err) {
      console.log('Error parsing URL coords:', err);
    }
    return null;
  };

  const handleUrlChange = (val: string) => {
    setGoogleMapsUrl(val);
    const parsed = parseCoordsFromGoogleMapsUrl(val);
    if (parsed) {
      setCoords(parsed);
    }
  };

  // Get current GPS position and reverse geocode address
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Trình duyệt của bạn không hỗ trợ định vị GPS.');
      return;
    }

    setIsLocating(true);
    setGpsSuccess(false);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        setCoords({ lat: latitude, lng: longitude });

        // Reverse geocode via OpenStreetMap Nominatim with Vietnamese language setting
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=vi`
          );
          if (res.ok) {
            const data = await res.json();
            if (data && data.display_name) {
              setAddress(data.display_name);
            }
          }
        } catch (err) {
          console.error('Lỗi lấy địa chỉ từ GPS:', err);
        } finally {
          setIsLocating(false);
          setGpsSuccess(true);
        }
      },
      (error) => {
        setIsLocating(false);
        alert('Không thể lấy tọa độ GPS: ' + error.message + '. Vui lòng kiểm tra quyền truy cập vị trí trên trình duyệt.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !address) return;

    // Build default Google Maps URL if user did not provide one
    const finalMapsUrl = googleMapsUrl.trim() ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((name + ' ' + address).trim())}`;

    const newPlace = await addPlace({
      name,
      category,
      address,
      phone: phone || 'Chưa cập nhật',
      description,
      imageUrl:
        imageUrl ||
        'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80',
      location: coords,
      googleMapsUrl: finalMapsUrl,
      addedBy: currentUser?.username || currentUser?.uid || 'Thành viên cộng đồng',
    });

    onPlaceAdded(newPlace);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/70 backdrop-blur-sm cursor-pointer" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-lg max-h-[88vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-800 relative my-auto p-4 md:p-6 space-y-4 animate-in fade-in zoom-in duration-200 overflow-hidden cursor-default" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-orange-100 text-orange-600 rounded-xl">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold text-gray-900 dark:text-white">Thêm Địa Điểm Mới</h2>
              <p className="text-[11px] text-gray-500">Đóng góp địa điểm du lịch & ăn uống chân thực vào ứng dụng</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="overflow-y-auto pr-1.5 space-y-3.5 flex-1 custom-scrollbar">

          {/* Location Action Buttons Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Quick GPS Location Button */}
            <div className="p-2.5 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/40 rounded-2xl border border-orange-200 dark:border-orange-800/60 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="p-1.5 bg-orange-600 text-white rounded-lg shadow-sm shrink-0">
                  <Navigation className="w-3.5 h-3.5 animate-bounce" />
                </div>
                <div className="truncate">
                  <div className="font-bold text-xs text-gray-900 dark:text-white truncate">Vị trí GPS</div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">Vị trí hiện tại</div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGetCurrentLocation}
                disabled={isLocating}
                className="px-2.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition shadow flex items-center gap-1 shrink-0"
              >
                {isLocating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang vị trí...</span>
                  </>
                ) : (
                  <>
                    <Compass className="w-3.5 h-3.5" />
                    <span>Lấy GPS</span>
                  </>
                )}
              </button>
            </div>

            {/* Select Location on Map Button */}
            <div className="p-2.5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 rounded-2xl border border-amber-200 dark:border-amber-800/60 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="p-1.5 bg-amber-600 text-white rounded-lg shadow-sm shrink-0">
                  <MapIcon className="w-3.5 h-3.5" />
                </div>
                <div className="truncate">
                  <div className="font-bold text-xs text-gray-900 dark:text-white truncate">Ghim trên bản đồ</div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">Chọn vị trí bất kỳ</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowMapPicker(true)}
                className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow flex items-center gap-1 shrink-0 active:scale-95"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Chọn trên bản đồ</span>
              </button>
            </div>
          </div>

          {gpsSuccess && (
            <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 p-2 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-1.5">
              <span>✓ Đã cập nhật tọa độ & địa chỉ vị trí ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})!</span>
              <button
                type="button"
                onClick={() => setShowMapPicker(true)}
                className="text-orange-600 dark:text-orange-400 hover:underline text-[10px] font-extrabold shrink-0"
              >
                Đổi vị trí
              </button>
            </div>
          )}

          {/* Form */}
          <form id="add-place-form" onSubmit={handleSubmit} className="space-y-3">
            
            {/* Name */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Tên địa điểm *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Gành Yến, Mũi Ba Làng An, Bãi biển Khe Hai..."
                className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Danh mục
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Address */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-orange-500" />
                  <span>Địa chỉ chi tiết *</span>
                </span>
                {address && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                    Tự động từ GPS
                  </span>
                )}
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="VD: Thôn Thanh Thủy, xã Bình Hải, huyện Bình Sơn..."
                className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
            </div>

            {/* Google Maps Link */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-orange-500" />
                  <span>Link địa chỉ Google Maps</span>
                </span>
                <span className="text-[10px] text-gray-400 font-normal">Tùy chọn</span>
              </label>
              <input
                type="url"
                value={googleMapsUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="VD: https://maps.app.goo.gl/... hoặc https://www.google.com/maps/place/..."
                className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Số điện thoại liên hệ
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="VD: 0345.678.910 hoặc Đang cập nhật"
                className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
            </div>

            {/* Hình ảnh địa điểm (Upload / Chụp ảnh / URL) */}
            <div className="space-y-2.5 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700/80">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-orange-500" />
                  <span>Hình ảnh địa điểm</span>
                </label>
                {imageUrl && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                    {imageSourceType === 'camera' ? '📷 Camera' : imageSourceType === 'upload' ? '📁 Tệp máy' : '🌐 URL'}
                  </span>
                )}
              </div>

              {/* Hidden native file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileUpload}
                className="hidden"
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Action Buttons: Upload & Live Camera */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="py-2 px-2.5 bg-white dark:bg-gray-900 hover:bg-orange-50 dark:hover:bg-orange-950/40 text-gray-800 dark:text-gray-200 hover:text-orange-600 dark:hover:text-orange-400 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5 text-orange-500" />
                  <span>Tải ảnh từ máy</span>
                </button>

                <button
                  type="button"
                  onClick={startLiveCamera}
                  className="py-2 px-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Chụp ảnh trực tiếp</span>
                </button>
              </div>

              {/* Live Camera Viewfinder Modal / View */}
              {isLiveCameraActive && (
                <div className="p-2.5 bg-black rounded-2xl space-y-2 relative overflow-hidden border border-orange-500 shadow-xl animate-in fade-in zoom-in duration-150">
                  <div className="flex items-center justify-between text-white text-xs font-bold px-1">
                    <span className="flex items-center gap-1.5 text-amber-400 text-[11px]">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                      Camera đang hoạt động
                    </span>
                    <button
                      type="button"
                      onClick={stopLiveCamera}
                      className="p-1 rounded-lg bg-white/20 hover:bg-white/30 text-white transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="relative aspect-video bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={stopLiveCamera}
                      className="px-2.5 py-1 rounded-lg bg-gray-800 text-gray-300 text-xs font-semibold flex items-center gap-1"
                    >
                      <CameraOff className="w-3 h-3" />
                      <span>Tắt</span>
                    </button>

                    <button
                      type="button"
                      onClick={captureSnapshot}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs shadow-lg flex items-center gap-1 transition active:scale-95"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Chụp ngay</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Image Preview Box */}
              {imageUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 group aspect-video bg-black/5">
                  <img src={imageUrl} alt="Xem trước địa điểm" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setImageUrl('');
                        setImageSourceType('url');
                      }}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa ảnh</span>
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Direct Image URL Option */}
              <div className="pt-0.5">
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    setImageSourceType('url');
                  }}
                  placeholder="Hoặc dán Link URL ảnh (https://...)"
                  className="w-full p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-[11px] focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Mô tả ngắn về địa điểm
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Vẻ đẹp thiên nhiên, thắng cảnh, lưu ý thời gian tham quan..."
                className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
            </div>
          </form>
        </div>

        {/* Fixed Footer Action Buttons */}
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold text-xs hover:bg-gray-200 transition"
          >
            Hủy
          </button>
          <button
            type="submit"
            form="add-place-form"
            className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-md shadow-orange-600/20 transition"
          >
            Lưu Địa Điểm
          </button>
        </div>

      </div>

      {/* Interactive Map Picker Modal */}
      {showMapPicker && (
        <MapLocationPicker
          initialCoords={coords}
          onConfirmLocation={handleConfirmMapLocation}
          onClose={() => setShowMapPicker(false)}
        />
      )}
    </div>
  );
};

