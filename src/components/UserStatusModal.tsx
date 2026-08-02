import React, { useState, useRef, useEffect } from 'react';
import { User, Place, Review } from '../types';
import {
  X,
  ShieldAlert,
  ShieldCheck,
  AlertOctagon,
  LogOut,
  LogIn,
  RefreshCw,
  User as UserIcon,
  Mail,
  Lock,
  Camera,
  Upload,
  Save,
  CheckCircle2,
  MapPin,
  MessageSquare,
  Shield,
  History,
  Sparkles,
  Video,
  Image as ImageIcon,
} from 'lucide-react';
import { updateUser, getPlaces, getReviews } from '../services/store';

interface UserStatusModalProps {
  user: User | null;
  onClose: () => void;
  onSwitchUser: (uid: string) => void;
  onResetData: () => void;
  onLogout?: () => void;
  onOpenAuth?: () => void;
  onUpdateUser?: () => void;
}

export const UserStatusModal: React.FC<UserStatusModalProps> = ({
  user,
  onClose,
  onSwitchUser,
  onResetData,
  onLogout,
  onOpenAuth,
  onUpdateUser,
}) => {
  if (!user) return null;

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'activity'>('profile');

  // Form State
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email);
  const [avatar, setAvatar] = useState(
    user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'
  );
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  const defaultAvatar = user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100';
  const isFormChanged =
    username.trim() !== user.username ||
    email.trim() !== user.email ||
    avatar !== defaultAvatar ||
    newPassword.trim() !== '' ||
    confirmPassword.trim() !== '';

  const isPasswordFilled = newPassword.length > 0 || confirmPassword.length > 0;
  const isPasswordMismatch = isPasswordFilled && newPassword !== confirmPassword;
  const canSubmit = isFormChanged && !isPasswordMismatch;

  // Camera & File Upload State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Fetch activity stats
  const userPlaces: Place[] = getPlaces().filter((p) => p.addedBy === user.username || p.addedBy === user.uid);
  const userReviews: Review[] = getReviews().filter((r) => r.userId === user.uid);

  const strikes = user.strikes;
  const isBanned = user.isBanned || strikes > 5;

  const AVATAR_PRESETS = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  ];

  // Stop camera stream on unmount or tab switch
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 400 }, height: { ideal: 400 }, facingMode: 'user' },
      });
      streamRef.current = stream;
      setIsCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError('Không thể truy cập camera. Vui lòng cấp quyền webcam trên trình duyệt.');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Crop center square
      const video = videoRef.current;
      const minDim = Math.min(video.videoWidth, video.videoHeight);
      const startX = (video.videoWidth - minDim) / 2;
      const startY = (video.videoHeight - minDim) / 2;
      ctx.drawImage(video, startX, startY, minDim, minDim, 0, 0, 300, 300);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setAvatar(dataUrl);
    }
    stopCamera();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setSaveError('Vui lòng chọn tập tin hình ảnh.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const minDim = Math.min(img.width, img.height);
          const startX = (img.width - minDim) / 2;
          const startY = (img.height - minDim) / 2;
          ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, 300, 300);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setAvatar(dataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');
    setSaveSuccess(false);

    if (!username.trim()) {
      setSaveError('Tên hiển thị không được để trống.');
      return;
    }

    if (newPassword || confirmPassword) {
      if (newPassword !== confirmPassword) {
        setSaveError('Mật khẩu mới và nhập lại mật khẩu không trùng khớp.');
        return;
      }
      if (newPassword.length < 4) {
        setSaveError('Mật khẩu mới phải có ít nhất 4 ký tự.');
        return;
      }
    }

    try {
      const updated: User = {
        ...user,
        username: username.trim(),
        email: email.trim(),
        avatar: avatar.trim(),
        password: newPassword.trim() ? newPassword.trim() : user.password,
      };

      await updateUser(updated);
      setSaveSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      if (onUpdateUser) onUpdateUser();

      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Lỗi cập nhật thông tin.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/70 backdrop-blur-sm cursor-pointer" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-800 relative animate-in fade-in zoom-in duration-200 cursor-default overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 pb-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0 bg-gray-50/50 dark:bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold text-lg border border-orange-200 dark:border-orange-800">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-gray-900 dark:text-white">Quản Lý Tài Khoản</h3>
              <p className="text-xs text-gray-500">Chỉnh sửa hồ sơ, độ uy tín & hoạt động</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher Navigation */}
        <div className="flex border-b border-gray-100 dark:border-gray-800 bg-gray-100/60 dark:bg-gray-800/50 px-3 pt-2 gap-1 shrink-0">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-t-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'profile'
                ? 'bg-white dark:bg-gray-900 text-orange-600 dark:text-orange-400 border-t border-x border-gray-200 dark:border-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Hồ sơ cá nhân</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-t-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'security'
                ? 'bg-white dark:bg-gray-900 text-orange-600 dark:text-orange-400 border-t border-x border-gray-200 dark:border-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Độ uy tín ({strikes}/5)</span>
          </button>

          <button
            onClick={() => setActiveTab('activity')}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-t-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'activity'
                ? 'bg-white dark:bg-gray-900 text-orange-600 dark:text-orange-400 border-t border-x border-gray-200 dark:border-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Hoạt động</span>
          </button>
        </div>

        {/* Tab Body Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: PROFILE EDIT */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {saveSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 rounded-2xl text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Đã cập nhật thông tin tài khoản thành công!</span>
                </div>
              )}

              {saveError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 rounded-2xl text-rose-800 dark:text-rose-200 text-xs">
                  {saveError}
                </div>
              )}

              {/* Hidden File Input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                className="hidden"
              />

              {/* Avatar Preview & Action Buttons */}
              <div className="p-3.5 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="relative group shrink-0">
                    <img
                      src={avatar}
                      alt="Avatar"
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-orange-500 shadow-md"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition"
                      title="Đổi ảnh đại diện"
                    >
                      <Upload className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="text-xs font-bold text-gray-800 dark:text-gray-200">
                      Tùy Chọn Ảnh Đại Diện:
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1.5 rounded-xl bg-orange-100 dark:bg-orange-950/60 border border-orange-300 dark:border-orange-800 text-orange-800 dark:text-orange-300 text-xs font-bold hover:bg-orange-200 transition flex items-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Tải ảnh lên</span>
                      </button>

                      <button
                        type="button"
                        onClick={isCameraActive ? stopCamera : startCamera}
                        className="px-2.5 py-1.5 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-bold hover:bg-gray-300 transition flex items-center gap-1.5"
                      >
                        <Camera className="w-3.5 h-3.5 text-orange-500" />
                        <span>{isCameraActive ? 'Tắt camera' : 'Chụp webcam'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Webcam Live Capture Viewfinder */}
                {isCameraActive && (
                  <div className="p-3 bg-black rounded-2xl space-y-2 flex flex-col items-center animate-in fade-in zoom-in duration-150">
                    <div className="relative w-48 h-48 rounded-xl overflow-hidden border-2 border-orange-500 bg-gray-900">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="px-4 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center gap-1.5 shadow"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Chụp Ngay</span>
                      </button>

                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-3 py-1.5 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 font-bold text-xs"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                )}

                {cameraError && (
                  <div className="text-[11px] text-rose-500 font-medium">
                    {cameraError}
                  </div>
                )}

                {/* Preset Avatars Carousel */}
                <div className="space-y-1 pt-1 border-t border-gray-200/60 dark:border-gray-700/60">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Hoặc chọn avatar có sẵn:
                  </span>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {AVATAR_PRESETS.map((url, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => setAvatar(url)}
                        className={`w-8 h-8 rounded-xl overflow-hidden border-2 transition ${
                          avatar === url ? 'border-orange-500 scale-105' : 'border-transparent opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={url} alt="preset" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Username Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                  <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                  <span>Tên hiển thị:</span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Nhập tên hiển thị..."
                  required
                />
              </div>

              {/* Email Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                  <span>Địa chỉ Email:</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="example@gmail.com"
                  required
                />
              </div>

              {/* New Password Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-gray-400" />
                  <span>Mật khẩu mới:</span>
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Nhập mật khẩu mới (để trống nếu không đổi)..."
                />
              </div>

              {/* Confirm New Password Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-gray-400" />
                    <span>Nhập lại mật khẩu mới:</span>
                  </span>
                  {isPasswordFilled && !isPasswordMismatch && (
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Trùng khớp
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition ${
                    isPasswordMismatch
                      ? 'border-rose-500 dark:border-rose-500 focus:ring-rose-500 bg-rose-50/20'
                      : isPasswordFilled && !isPasswordMismatch
                      ? 'border-emerald-500 dark:border-emerald-500 focus:ring-emerald-500'
                      : 'border-gray-200 dark:border-gray-700 focus:ring-orange-500'
                  }`}
                  placeholder="Xác nhận mật khẩu mới..."
                />
                {isPasswordMismatch && (
                  <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1 mt-0.5">
                    ⚠️ Nhập lại mật khẩu không trùng khớp với mật khẩu mới.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className={`w-full py-2.5 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 ${
                  canSubmit
                    ? 'bg-orange-600 hover:bg-orange-700 text-white shadow active:scale-95 cursor-pointer'
                    : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed border border-gray-300/50 dark:border-gray-700/50'
                }`}
              >
                <Save className="w-4 h-4" />
                <span>Cập Nhật Hồ Sơ</span>
              </button>
            </form>
          )}

          {/* TAB 2: STRIKES & SECURITY */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-gray-700 dark:text-gray-300">Thước đo vi phạm (Strikes):</span>
                  <span
                    className={
                      strikes >= 5
                        ? 'text-red-600 font-extrabold'
                        : strikes >= 3
                        ? 'text-amber-600'
                        : 'text-emerald-600'
                    }
                  >
                    {strikes} / 5 Vi phạm
                  </span>
                </div>

                {/* Meter progress bar */}
                <div className="w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden p-0.5 border border-gray-200 dark:border-gray-700">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      strikes >= 5
                        ? 'bg-rose-600'
                        : strikes >= 3
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, (strikes / 5) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Status Alert Box */}
              {isBanned ? (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-2xl text-xs text-rose-900 dark:text-rose-200 space-y-1.5">
                  <div className="font-extrabold flex items-center gap-1.5 text-rose-700 dark:text-rose-400 text-sm">
                    <AlertOctagon className="w-4 h-4" />
                    <span>Tài Khoản Đã Bị Khóa 6 Tháng!</span>
                  </div>
                  <p>
                    Lý do: Vi phạm vượt quá 5 lần quy định review seeding rác / quảng cáo ảo. Thời hạn khóa đến ngày:{' '}
                    {new Date(user.banUntil || Date.now() + 180 * 86400000).toLocaleDateString('vi-VN')}.
                  </p>
                </div>
              ) : strikes > 0 ? (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    <span>Cảnh báo vi phạm seeding ({strikes}/5)</span>
                  </div>
                  <p>
                    Bạn đã bị Gemini AI cờ đỏ {strikes} lần vì gửi review mang tính chất quảng cáo/seeding. Thêm {5 - strikes} lần nữa tài khoản sẽ bị khóa 6 tháng.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-2xl text-xs text-emerald-900 dark:text-emerald-200 space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Tài khoản uy tín (0 Strike)</span>
                  </div>
                  <p>Bạn là người dùng gương mẫu, chưa từng bị AI phát hiện review rác seeding.</p>
                </div>
              )}

              {/* How AI Anti-Seeding Works Info */}
              <div className="p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/50 rounded-2xl text-xs text-orange-900 dark:text-orange-200 space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                  <span>Quy tắc Gemini AI Anti-Seeding:</span>
                </div>
                <p className="text-[11px] text-orange-800 dark:text-orange-300">
                  Hệ thống tự động phát hiện số điện thoại chốt đơn, câu từ quảng cáo dịch vụ ảo, hoặc bình luận spam lặp lại.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: USER ACTIVITY */}
          {activeTab === 'activity' && (
            <div className="space-y-4 text-xs">
              {/* Stat Counters */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-800 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-black text-base text-gray-900 dark:text-white">{userPlaces.length}</div>
                    <div className="text-[10px] text-gray-500">Địa điểm đã thêm</div>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-800 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-black text-base text-gray-900 dark:text-white">{userReviews.length}</div>
                    <div className="text-[10px] text-gray-500">Review đã đăng</div>
                  </div>
                </div>
              </div>

              {/* Places List */}
              <div className="space-y-2">
                <h4 className="font-bold text-gray-700 dark:text-gray-300 text-xs">Địa Điểm Đã Thêm ({userPlaces.length}):</h4>
                {userPlaces.length === 0 ? (
                  <p className="text-gray-400 text-xs italic">Bạn chưa đóng góp địa điểm nào.</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {userPlaces.map((p) => (
                      <div key={p.placeId} className="p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-800 flex items-center gap-2.5">
                        <img src={p.imageUrl} alt={p.name} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                        <div className="truncate flex-1">
                          <div className="font-bold text-gray-900 dark:text-white truncate">{p.name}</div>
                          <div className="text-[10px] text-gray-500 truncate">{p.address}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reviews List */}
              <div className="space-y-2">
                <h4 className="font-bold text-gray-700 dark:text-gray-300 text-xs">Review Gần Đây ({userReviews.length}):</h4>
                {userReviews.length === 0 ? (
                  <p className="text-gray-400 text-xs italic">Bạn chưa viết đánh giá nào.</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {userReviews.map((r) => (
                      <div key={r.reviewId} className="p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-800 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-amber-500">⭐ {r.rating} / 5</span>
                          <span className="text-[10px] text-gray-400">{new Date(r.createdAt).toLocaleDateString('vi-VN')}</span>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 line-clamp-2">{r.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between shrink-0">
          {onLogout ? (
            <button
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="py-2 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 font-bold text-xs transition flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng xuất</span>
            </button>
          ) : <div />}

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onResetData();
                onClose();
              }}
              className="p-2 text-gray-400 hover:text-rose-600 text-xs flex items-center gap-1 transition"
              title="Reset dữ liệu thử nghiệm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold text-xs rounded-xl transition"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

