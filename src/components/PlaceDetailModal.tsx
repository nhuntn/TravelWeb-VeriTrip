import React, { useState, useEffect } from 'react';
import { Place, Review, User, AISummary } from '../types';
import { submitReviewWithAI } from '../services/store';
import {
  X,
  Star,
  MapPin,
  Phone,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ExternalLink,
  Navigation,
  ChevronDown,
} from 'lucide-react';

interface PlaceDetailModalProps {
  place: Place;
  reviews: Review[];
  currentUser: User | null;
  onClose: () => void;
  onReviewSubmitted: () => void;
  onSwitchUser: (uid: string) => void;
  onOpenAuth?: () => void;
}

export const PlaceDetailModal: React.FC<PlaceDetailModalProps> = ({
  place,
  reviews,
  currentUser,
  onClose,
  onReviewSubmitted,
  onSwitchUser,
  onOpenAuth,
}) => {
  // Review form state
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastAnalysis, setLastAnalysis] = useState<any | null>(null);

  // Filter reviews
  const [reviewFilter, setReviewFilter] = useState<'ALL' | 'CLEAN' | 'SEEDING'>('ALL');

  // Track expanded seeding reasons for reviews
  const [expandedReasonIds, setExpandedReasonIds] = useState<Record<string, boolean>>({});

  const toggleReason = (reviewId: string) => {
    setExpandedReasonIds((prev) => ({
      ...prev,
      [reviewId]: !prev[reviewId],
    }));
  };

  // Submit Review
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setLastAnalysis(null);

    try {
      const result = await submitReviewWithAI(place.placeId, place.name, rating, content);
      setLastAnalysis(result.aiAnalysis);
      setContent('');
      onReviewSubmitted();
    } catch (err: any) {
      setSubmitError(err.message || 'Đã có lỗi xảy ra.');
    } finally {
      setIsSubmitting(false);
    }
  };



  const filteredReviews = reviews.filter((r) => {
    if (reviewFilter === 'CLEAN') return !r.isSeeding;
    if (reviewFilter === 'SEEDING') return r.isSeeding;
    return true;
  });

  const totalReviewsCount = reviews.length;
  const avgRatingValue =
    totalReviewsCount > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviewsCount).toFixed(1)
      : null;
  const averageRatingDisplay = avgRatingValue !== null ? `${avgRatingValue} / 5.0` : '?';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto cursor-pointer" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-800 relative my-8 animate-in fade-in zoom-in duration-200 cursor-default" onClick={(e) => e.stopPropagation()}>
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition shadow-md"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Hero Image Banner */}
        <div className="relative h-64 md:h-80 w-full bg-gray-100 dark:bg-gray-800">
          <img src={place.imageUrl} alt={place.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

          <div className="absolute bottom-6 left-6 right-6 flex flex-col md:flex-row md:items-end justify-between gap-3 text-white">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-600/90 backdrop-blur-md">
                  {place.category}
                </span>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-md border border-white/30">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>{averageRatingDisplay}</span>
                  <span className="text-white/70">({totalReviewsCount} đánh giá)</span>
                </div>
              </div>

              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">{place.name}</h2>

              <p className="text-xs md:text-sm text-gray-200 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-orange-400 shrink-0" />
                <span>{place.address}</span>
              </p>
            </div>

            {/* Google Maps Link Button in Banner */}
            <a
              href={
                place.googleMapsUrl ||
                `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((place.name + ' ' + place.address).trim())}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-lg transition shrink-0 active:scale-95"
            >
              <Navigation className="w-4 h-4" />
              <span>Mở Google Maps</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 md:p-8 space-y-8">
          
          {/* Place Info Details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-200/80 dark:border-gray-800">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Số điện thoại</span>
              <div className="text-xs font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5 mt-0.5">
                <Phone className="w-3.5 h-3.5 text-orange-500" />
                <span>{place.phone || 'Chưa cập nhật'}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bản đồ Google Maps</span>
              <div className="text-xs font-bold text-orange-600 dark:text-orange-400 mt-0.5">
                <a
                  href={
                    place.googleMapsUrl ||
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((place.name + ' ' + place.address).trim())}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:underline text-xs"
                >
                  <Navigation className="w-3.5 h-3.5 shrink-0" />
                  <span>Mở liên kết</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Chỉ số AI Anti-Seeding</span>
              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mt-0.5">
                <ShieldCheck className="w-4 h-4" />
                <span>{place.trustScore}% Độ tin cậy</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Người đóng góp</span>
              <div className="text-xs font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
                Thành viên cộng đồng
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Giới thiệu địa điểm</h3>
            <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              {place.description}
            </p>
          </div>

          {/* REVIEWS LIST SECTION */}
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                Đánh Giá Từ Cộng Đồng ({reviews.length})
              </h3>

              {/* Review Filter Tabs */}
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setReviewFilter('ALL')}
                  className={`px-3 py-1 rounded-lg transition ${
                    reviewFilter === 'ALL'
                      ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500'
                  }`}
                >
                  Tất cả ({reviews.length})
                </button>
                <button
                  onClick={() => setReviewFilter('CLEAN')}
                  className={`px-3 py-1 rounded-lg transition ${
                    reviewFilter === 'CLEAN'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'text-gray-500'
                  }`}
                >
                  Đánh giá thật ({reviews.filter((r) => !r.isSeeding).length})
                </button>
                <button
                  onClick={() => setReviewFilter('SEEDING')}
                  className={`px-3 py-1 rounded-lg transition ${
                    reviewFilter === 'SEEDING'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-gray-500'
                  }`}
                >
                  Cảnh báo Seeding ({reviews.filter((r) => r.isSeeding).length})
                </button>
              </div>
            </div>

            {/* Reviews Cards List */}
            <div className="space-y-3">
              {filteredReviews.length > 0 ? (
                filteredReviews.map((rev) => (
                  <div
                    key={rev.reviewId}
                    className="p-4 rounded-2xl border transition-all bg-white dark:bg-gray-800/80 border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={rev.userAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                          alt={rev.userName}
                          className="w-8 h-8 rounded-full object-cover border border-gray-200"
                        />
                        <div>
                          <div className="font-bold text-xs text-gray-900 dark:text-white">
                            {rev.userName}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {new Date(rev.createdAt).toLocaleDateString('vi-VN')}
                          </div>
                        </div>
                      </div>

                      {/* AI Anti-Seeding Status Badge */}
                      {rev.isSeeding ? (
                        <button
                          type="button"
                          onClick={() => toggleReason(rev.reviewId)}
                          className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1 shrink-0 hover:bg-amber-200 dark:hover:bg-amber-900 transition active:scale-95 cursor-pointer shadow-sm"
                          title="Nhấn để ẩn/hiện lý do cảnh báo"
                        >
                          <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                          <span>Cảnh báo seeding</span>
                          <ChevronDown
                            className={`w-3 h-3 transition-transform duration-200 ${
                              expandedReasonIds[rev.reviewId] ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                      ) : (
                        <div className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1 shrink-0">
                          <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>An toàn</span>
                        </div>
                      )}
                    </div>

                    {/* Star Rating & Content */}
                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-3.5 h-3.5 ${
                              star <= rev.rating
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-gray-300 dark:text-gray-600'
                            }`}
                          />
                        ))}
                      </div>

                      <p className="text-xs md:text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
                        {rev.content}
                      </p>

                      {/* Seeding Warning Reason Banner */}
                      {rev.isSeeding && expandedReasonIds[rev.reviewId] && (
                        <div className="mt-2 p-3 bg-amber-100/80 dark:bg-amber-900/40 rounded-xl text-xs text-amber-900 dark:text-amber-200 space-y-1 border border-amber-200 dark:border-amber-800 animate-in fade-in duration-200">
                          <div className="font-bold flex items-center gap-1 text-amber-800 dark:text-amber-300">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Lý do cảnh báo từ Gemini AI:</span>
                          </div>
                          <p>{rev.seedingReason}</p>
                          {rev.detectedKeywords && rev.detectedKeywords.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap pt-1">
                              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">Từ khóa nghi vấn:</span>
                              {rev.detectedKeywords.map((kw, i) => (
                                <span key={i} className="px-1.5 py-0.5 bg-amber-200/80 dark:bg-amber-800/60 rounded text-[10px] font-mono font-bold text-amber-900 dark:text-amber-100">
                                  {kw}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-gray-500 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-200 dark:border-gray-800">
                  Không có đánh giá nào phù hợp với bộ lọc này.
                </div>
              )}
            </div>
          </div>

          {/* ADD REVIEW FORM WITH AI ANTI-SEEDING EVALUATOR */}
          <div className="bg-gray-50 dark:bg-gray-800/60 p-6 rounded-3xl border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                  Viết Đánh Giá Mới
                </h3>
                <p className="text-xs text-gray-500">
                  Mọi đánh giá sẽ tự động được Gemini AI phân tích. Cố tình gửi seeding quảng cáo &gt; 5 lần sẽ bị cấm tài khoản 6 tháng.
                </p>
              </div>
            </div>

            {!currentUser ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2">
                <span>Bạn cần đăng nhập để gửi đánh giá cho địa điểm này.</span>
                <button
                  onClick={() => {
                    if (onOpenAuth) onOpenAuth();
                    else onSwitchUser('user_demo_1');
                  }}
                  className="px-3 py-1.5 bg-orange-600 text-white font-bold rounded-xl text-xs hover:bg-orange-700 transition shrink-0"
                >
                  Đăng nhập / Đăng ký
                </button>
              </div>
            ) : currentUser.isBanned ? (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-2xl text-xs text-rose-900 dark:text-rose-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                  <XCircle className="w-4 h-4" />
                  <span>Tài khoản của bạn đã bị cấm đăng bài!</span>
                </div>
                <p>
                  Do vi phạm vượt quá 5 lần quy định đăng review seeding rác (Tổng số vi phạm: {currentUser.strikes} lần). Tài khoản bị tạm khóa 6 tháng đến ngày: {new Date(currentUser.banUntil || '').toLocaleDateString('vi-VN')}.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReview} className="space-y-4">
                
                {/* Rating selection */}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Đánh giá sao:</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setRating(s)}
                        className="p-1 hover:scale-110 transition"
                      >
                        <Star
                          className={`w-6 h-6 ${
                            s <= rating
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-gray-300 dark:text-gray-600'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>



                {/* Review Text Input */}
                <div>
                  <textarea
                    rows={3}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Chia sẻ trải nghiệm ăn uống, không gian, vị trí thực tế của bạn..."
                    className="w-full p-3.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs md:text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    required
                  />
                </div>

                {/* Error Banner */}
                {submitError && (
                  <div className="p-3 bg-rose-100 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                    <XCircle className="w-4 h-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                {/* Last Analysis AI Result Toast */}
                {lastAnalysis && (
                  <div
                    className={`p-4 rounded-2xl text-xs space-y-1.5 border animate-in fade-in slide-in-from-bottom-2 ${
                      lastAnalysis.isSeeding
                        ? 'bg-amber-50 text-amber-900 border-amber-300'
                        : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5 text-sm">
                      {lastAnalysis.isSeeding ? (
                        <>
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          <span>Gemini AI: CẢNH BÁO PHÁT HIỆN SEEDING (+1 Strike)</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          <span>Gemini AI: XÁC NHẬN ĐÁNH GIÁ SẠCH CHÂN THỰC</span>
                        </>
                      )}
                    </div>
                    <p>{lastAnalysis.seedingReason}</p>
                  </div>
                )}

                {/* Submit button */}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting || !content.trim()}
                    className="px-5 py-2.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-lg shadow-orange-600/20 transition flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>AI Trọng Tài Đang Kiểm Duyệt...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Gửi đánh giá</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
