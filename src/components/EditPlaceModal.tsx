import React, { useState, useEffect, useRef } from 'react';
import { LocationCoordinates, Place, User } from '../types';
import { updatePlace } from '../services/store';
import {
  X,
  MapPin,
  Save,
  Image as ImageIcon,
  Building2,
  Phone,
  FileText,
  Compass,
  Loader2,
  Navigation,
  ExternalLink,
  Link2,
  Camera,
  Upload,
  Trash2,
  CameraOff,
  RefreshCw,
  Map as MapIcon,
  Pencil,
  CheckCircle2,
} from 'lucide-react';
import { MapLocationPicker } from './MapLocationPicker';
import { parseCoordsFromGoogleMapsUrl } from '../utils/mapUtils';

interface EditPlaceModalProps {
  place: Place;
  userLocation: LocationCoordinates | null;
  onClose: () => void;
  onPlaceUpdated: (updatedPlace: Place) => void;
  currentUser?: User | null;
}

const CATEGORIES = [
  'Thắng cảnh thiên nhiên',
  'Bãi biển',
  'Du lịch sinh thái',
  'Làng văn hóa',
  'Nhà hàng',
  'Quán cafe',
  'Ăn vặt',
  'Vui chơi',
  'Khách sạn / Homestay',
];

export const EditPlaceModal: React.FC<EditPlaceModalProps> = ({
  place,
  userLocation,
  onClose,
  onPlaceUpdated,
  currentUser,
}) => {
  const [name, setName] = useState(place.name || '');
  const [category, setCategory] = useState(place.category || CATEGORIES[0]);
  const [address, setAddress] = useState(place.address || '');
  const [phone, setPhone] = useState(place.phone || '');
  const [description, setDescription] = useState(place.description || '');
  const [imageUrl, setImageUrl] = useState(place.imageUrl || '');
  const [googleMapsUrl, setGoogleMapsUrl] = useState(place.googleMapsUrl || '');
  const [coords, setCoords] = useState<LocationCoordinates>(
    place.location || userLocation || { lat: 15.3405, lng: 108.9212 }
  );
  const [parsedUrlCoords, setParsedUrlCoords] = useState<LocationCoordinates | null>(
    place.googleMapsUrl ? parseCoordsFromGoogleMapsUrl(place.googleMapsUrl) : null
  );

  const [isLocating, setIsLocating] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleConfirmMapLocation = (pickedCoords: LocationCoordinates, pickedAddress: string) => {
    setCoords(pickedCoords);
    if (pickedAddress) {
      setAddress(pickedAddress);
    }
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
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Start webcam
  const startCameraStream = async () => {
    try {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      setMediaStream(stream);
      setIsLiveCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Cannot open camera directly, falling back to camera input file', err);
      cameraInputRef.current?.click();
    }
  };

  // Stop webcam stream
  const stopCameraStream = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      setMediaStream(null);
    }
    setIsLiveCameraActive(false);
  };

  // Capture photo frame from video element
  const capturePhotoFromCamera = () => {
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
        stopCameraStream();
      }
    }
  };

  useEffect(() => {
    if (isLiveCameraActive && videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [isLiveCameraActive, mediaStream]);

  useEffect(() => {
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [mediaStream]);

  // Handle Google Maps URL change & parse coordinates
  const handleUrlChange = (val: string) => {
    setGoogleMapsUrl(val);
    const parsed = parseCoordsFromGoogleMapsUrl(val);
    if (parsed) {
      setCoords(parsed);
      setParsedUrlCoords(parsed);
    } else {
      setParsedUrlCoords(null);
    }
  };

  // Handle GPS Auto-detect location
  const handleGetDeviceGPS = () => {
    if (!navigator.geolocation) {
      alert('Trình duyệt không hỗ trợ Geolocation.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setIsLocating(false);
      },
      (error) => {
        console.warn('GPS error:', error);
        setIsLocating(false);
        alert('Không thể lấy tọa độ GPS hiện tại. Vui lòng chọn trên bản đồ.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim()) return;

    setIsSaving(true);
    let finalMapsUrl = googleMapsUrl.trim();
    if (!finalMapsUrl) {
      finalMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        (name + ' ' + address).trim()
      )}`;
    }

    const updatedData: Place = {
      ...place,
      name: name.trim(),
      category,
      address: address.trim(),
      phone: phone.trim(),
      description: description.trim(),
      imageUrl:
        imageUrl.trim() ||
        place.imageUrl ||
        'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80',
      location: coords,
      googleMapsUrl: finalMapsUrl,
    };

    const savedPlace = await updatePlace(updatedData);
    setIsSaving(false);
    onPlaceUpdated(savedPlace);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto cursor-pointer"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-800 relative my-8 animate-in fade-in zoom-in duration-200 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/20 hover:bg-black/40 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30">
              <Pencil className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold">Chỉnh Sửa Địa Điểm</h2>
              <p className="text-xs text-orange-100">
                Cập nhật thông tin, hình ảnh & tọa độ bản đồ của {place.name}
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {/* Place Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-orange-500" />
              <span>Tên địa điểm / Quán *</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Quán Cơm Gà Bà Buông, Bãi Biển An Bàng..."
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Danh mục *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-orange-500" />
              <span>Địa chỉ chi tiết *</span>
            </label>
            <input
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="VD: 123 Đường Trần Phú, Phường Minh An, Hội An"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
            />
          </div>

          {/* Google Maps Link */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Link2 className="w-4 h-4 text-orange-500" />
                <span>Link địa chỉ Google Maps</span>
              </span>
              <span className="text-[10px] text-gray-400 font-normal">Tùy chọn</span>
            </label>
            <input
              type="url"
              value={googleMapsUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="VD: https://maps.app.goo.gl/... hoặc https://www.google.com/maps/place/..."
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
            />
            {parsedUrlCoords && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/50 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                <span>Đã trích xuất tọa độ & định vị bản đồ: <b>{parsedUrlCoords.lat.toFixed(5)}, {parsedUrlCoords.lng.toFixed(5)}</b></span>
              </div>
            )}
          </div>

          {/* Coordinates & Map Selection */}
          <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-orange-500" />
                <span>Tọa độ GPS & Bản đồ</span>
              </div>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300">
                {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleGetDeviceGPS}
                disabled={isLocating}
                className="py-2 px-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition"
              >
                {isLocating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500" />
                ) : (
                  <Navigation className="w-3.5 h-3.5 text-orange-500" />
                )}
                <span>{isLocating ? 'Đang xác định GPS...' : 'Định vị GPS thiết bị'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowMapPicker(true)}
                className="py-2 px-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition"
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>Chọn trên Bản đồ</span>
              </button>
            </div>
          </div>

          {/* Image Selection Tabs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-orange-500" />
                <span>Hình ảnh địa điểm</span>
              </label>
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setImageSourceType('url')}
                  className={`px-2 py-1 rounded-md transition ${
                    imageSourceType === 'url'
                      ? 'bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 shadow-xs'
                      : 'text-gray-500'
                  }`}
                >
                  Link URL
                </button>
                <button
                  type="button"
                  onClick={() => setImageSourceType('upload')}
                  className={`px-2 py-1 rounded-md transition ${
                    imageSourceType === 'upload'
                      ? 'bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 shadow-xs'
                      : 'text-gray-500'
                  }`}
                >
                  Tải ảnh lên
                </button>
                <button
                  type="button"
                  onClick={() => setImageSourceType('camera')}
                  className={`px-2 py-1 rounded-md transition ${
                    imageSourceType === 'camera'
                      ? 'bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 shadow-xs'
                      : 'text-gray-500'
                  }`}
                >
                  Chụp Camera
                </button>
              </div>
            </div>

            {/* Hidden File Inputs */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              onChange={handleFileUpload}
              className="hidden"
            />

            {imageSourceType === 'url' && (
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://images.unsplash.com/photo-..."
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
              />
            )}

            {imageSourceType === 'upload' && (
              <div className="p-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl text-center bg-gray-50 dark:bg-gray-800/50 space-y-2">
                <Upload className="w-8 h-8 text-orange-500 mx-auto" />
                <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                  Chọn hình ảnh từ thiết bị của bạn
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
                >
                  Browse File...
                </button>
              </div>
            )}

            {imageSourceType === 'camera' && (
              <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-800 space-y-3">
                {isLiveCameraActive ? (
                  <div className="space-y-2">
                    <div className="relative rounded-xl overflow-hidden bg-black aspect-video max-h-56">
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                      <canvas ref={canvasRef} className="hidden" />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={capturePhotoFromCamera}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Chụp Ảnh Ngay</span>
                      </button>
                      <button
                        type="button"
                        onClick={stopCameraStream}
                        className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold text-xs rounded-xl hover:bg-gray-300 transition"
                      >
                        <CameraOff className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 space-y-2">
                    <Camera className="w-8 h-8 text-orange-500 mx-auto animate-bounce" />
                    <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                      Mở máy ảnh thiết bị để chụp ảnh thực tế tại địa điểm
                    </p>
                    <button
                      type="button"
                      onClick={startCameraStream}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-sm transition inline-flex items-center gap-1.5"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Bật Máy Ảnh</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Image Preview */}
            {imageUrl && (
              <div className="relative rounded-xl overflow-hidden h-32 border border-gray-200 dark:border-gray-700 group mt-2">
                <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-rose-600 text-white transition shadow-sm"
                  title="Xóa ảnh"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-orange-500" />
              <span>Số điện thoại liên hệ</span>
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="VD: 0905 123 456"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-orange-500" />
              <span>Mô tả ngắn & Điểm nổi bật</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="VD: Quán ăn gia truyền hơn 30 năm, nổi tiếng với nước dùng đượm đà và thịt gà thả vườn mềm ngọt..."
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
            />
          </div>

          {/* Submit Action */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-bold transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold shadow-lg transition flex items-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isSaving ? 'Đang Lưu...' : 'Cập Nhật Địa Điểm'}</span>
            </button>
          </div>
        </form>

        {/* Modal Pick Location from Map */}
        {showMapPicker && (
          <MapLocationPicker
            initialCoords={coords}
            onClose={() => setShowMapPicker(false)}
            onConfirmLocation={handleConfirmMapLocation}
          />
        )}
      </div>
    </div>
  );
};
