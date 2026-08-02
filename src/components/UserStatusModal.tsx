import React from 'react';
import { User } from '../types';
import { X, ShieldAlert, ShieldCheck, AlertOctagon, UserCheck, RefreshCw, LogOut, LogIn } from 'lucide-react';

interface UserStatusModalProps {
  user: User | null;
  onClose: () => void;
  onSwitchUser: (uid: string) => void;
  onResetData: () => void;
  onLogout?: () => void;
  onOpenAuth?: () => void;
}

export const UserStatusModal: React.FC<UserStatusModalProps> = ({
  user,
  onClose,
  onSwitchUser,
  onResetData,
  onLogout,
  onOpenAuth,
}) => {
  if (!user) return null;

  const strikes = user.strikes;
  const isBanned = user.isBanned || strikes > 5;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm cursor-pointer" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-800 p-6 md:p-8 space-y-6 relative animate-in fade-in zoom-in duration-200 cursor-default" onClick={(e) => e.stopPropagation()}>
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* User Profile Header */}
        <div className="flex items-center gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
          <img
            src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
            alt={user.username}
            className="w-14 h-14 rounded-2xl object-cover border-2 border-orange-500 shadow-md"
          />
          <div>
            <h3 className="font-extrabold text-lg text-gray-900 dark:text-white">{user.username}</h3>
            <p className="text-xs text-gray-500">{user.email}</p>
            <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
              Chế độ: Đã đăng nhập
            </span>
          </div>
        </div>

        {/* STRIKES & BAN STATUS CARD */}
        <div className="space-y-3">
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

          {/* Status Alert Box */}
          {isBanned ? (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-2xl text-xs text-rose-900 dark:text-rose-200 space-y-1">
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
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Cảnh báo vi phạm seeding ({strikes}/5)</span>
              </div>
              <p>
                Bạn đã bị Gemini AI cờ đỏ {strikes} lần vì gửi review mang tính chất quảng cáo/seeding. Thêm {5 - strikes} lần nữa tài khoản sẽ bị khóa 6 tháng.
              </p>
            </div>
          ) : (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-2xl text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Tài khoản uy tín (0 Strike)</span>
              </div>
              <p>Bạn là người dùng gương mẫu, chưa từng bị AI phát hiện review rác seeding.</p>
            </div>
          )}
        </div>

        {/* Account Actions & Logout Button */}
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-2">
          {onLogout && (
            <button
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow flex items-center justify-center gap-2 active:scale-95"
            >
              <LogOut className="w-4 h-4" />
              <span>Đăng Xuất Khỏi Tài Khoản này</span>
            </button>
          )}

          {onOpenAuth && (
            <button
              onClick={() => {
                onClose();
                onOpenAuth();
              }}
              className="w-full py-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold text-xs transition flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4 text-orange-500" />
              <span>Đăng nhập tài khoản khác / Đăng ký</span>
            </button>
          )}
        </div>

        {/* Reset Store Option */}
        <div className="pt-2 flex justify-between items-center">
          <button
            onClick={() => {
              onResetData();
              onClose();
            }}
            className="text-xs text-gray-400 hover:text-rose-600 flex items-center gap-1 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Dữ Liệu Demo</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl hover:bg-gray-200 transition"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
