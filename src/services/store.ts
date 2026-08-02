import { INITIAL_PLACES, INITIAL_REVIEWS, INITIAL_USERS } from '../data/initialData';
import { AIAnalysisResult, Place, Review, User } from '../types';

const STORAGE_KEYS = {
  USERS: 'travelweb_users_v1',
  PLACES: 'travelweb_places_v1',
  REVIEWS: 'travelweb_reviews_v1',
  CURRENT_USER_ID: 'travelweb_current_user_id_v2',
};

// Initialize localStorage if empty
export function initStore() {
  if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.PLACES)) {
    localStorage.setItem(STORAGE_KEYS.PLACES, JSON.stringify(INITIAL_PLACES));
  }
  if (!localStorage.getItem(STORAGE_KEYS.REVIEWS)) {
    localStorage.setItem(STORAGE_KEYS.REVIEWS, JSON.stringify(INITIAL_REVIEWS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID)) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, 'guest'); // Default logged out (guest)
  }
}

// User methods
export function getUsers(): User[] {
  initStore();
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
}

export function getCurrentUser(): User | null {
  initStore();
  const currentId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID);
  if (!currentId || currentId === 'guest') return null;

  const users = getUsers();
  let user = users.find((u) => u.uid === currentId) || null;

  // Check ban status if strikes > 5
  if (user && user.strikes > 5 && !user.isBanned) {
    const banDate = new Date();
    banDate.setDate(banDate.getDate() + 180); // 6 months ban
    user.isBanned = true;
    user.banUntil = banDate.toISOString();
    updateUser(user);
  }

  return user;
}

export function setCurrentUserId(uid: string) {
  initStore();
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, uid);
}

export function logoutUser() {
  initStore();
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, 'guest');
}

export function loginUser(email: string, password?: string): User {
  initStore();
  const users = getUsers();
  const normalizedEmail = email.trim().toLowerCase();
  let user = users.find((u) => u.email.toLowerCase() === normalizedEmail);

  if (user) {
    if (password && user.password && user.password !== password) {
      throw new Error('Mật khẩu không chính xác.');
    }
  } else {
    // If user does not exist yet, auto-create a user profile for smooth login
    const username = email.split('@')[0];
    user = {
      uid: 'user_' + Date.now(),
      email: email.trim(),
      username: username.charAt(0).toUpperCase() + username.slice(1),
      password: password || '123456',
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`,
      strikes: 0,
      isBanned: false,
      banUntil: null,
      role: 'user',
    };
    users.push(user);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }

  localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, user.uid);
  return user;
}

export function registerUser(data: { username: string; email: string; password?: string; avatar?: string }): User {
  initStore();
  const users = getUsers();
  const normalizedEmail = data.email.trim().toLowerCase();

  const existing = users.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (existing) {
    throw new Error('Email này đã được đăng ký. Vui lòng sử dụng tính năng Đăng nhập.');
  }

  const newUser: User = {
    uid: 'user_' + Date.now(),
    email: data.email.trim(),
    username: data.username.trim(),
    password: data.password || '123456',
    avatar:
      data.avatar ||
      `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
    strikes: 0,
    isBanned: false,
    banUntil: null,
    role: 'user',
  };

  users.push(newUser);
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, newUser.uid);

  return newUser;
}

export function updateUser(updatedUser: User) {
  const users = getUsers();
  const index = users.findIndex((u) => u.uid === updatedUser.uid);
  if (index !== -1) {
    users[index] = updatedUser;
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }
}

// Places methods
export function getPlaces(): Place[] {
  initStore();
  const places: Place[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLACES) || '[]');
  const reviews: Review[] = getReviews();

  // Re-calculate trust score & average rating dynamically
  return places.map((place) => {
    const placeReviews = reviews.filter((r) => r.placeId === place.placeId);
    if (placeReviews.length === 0) return place;

    const cleanReviews = placeReviews.filter((r) => !r.isSeeding);
    const avgRating = cleanReviews.length > 0
      ? Number((cleanReviews.reduce((sum, r) => sum + r.rating, 0) / cleanReviews.length).toFixed(1))
      : place.averageRating;

    const trustScore = Math.max(0, Math.round(((placeReviews.length - (placeReviews.length - cleanReviews.length)) / placeReviews.length) * 100));

    return {
      ...place,
      reviewCount: placeReviews.length,
      averageRating: avgRating,
      trustScore,
    };
  });
}

export function addPlace(newPlaceData: Omit<Place, 'placeId' | 'reviewCount' | 'createdAt' | 'trustScore' | 'averageRating'>): Place {
  const places = getPlaces();
  const newPlace: Place = {
    ...newPlaceData,
    placeId: 'place_' + Date.now(),
    averageRating: 5.0,
    reviewCount: 0,
    createdAt: new Date().toISOString(),
    trustScore: 100,
  };

  places.unshift(newPlace);
  localStorage.setItem(STORAGE_KEYS.PLACES, JSON.stringify(places));
  return newPlace;
}

// Reviews methods
export function getReviews(placeId?: string): Review[] {
  initStore();
  const reviews: Review[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.REVIEWS) || '[]');
  if (placeId) {
    return reviews.filter((r) => r.placeId === placeId);
  }
  return reviews;
}

// Core AI Anti-Seeding Review submission logic
export async function submitReviewWithAI(
  placeId: string,
  placeName: string,
  rating: number,
  content: string
): Promise<{ review: Review; aiAnalysis: AIAnalysisResult; userStatusUpdated: User | null }> {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error('Bạn cần đăng nhập để gửi đánh giá.');
  }

  if (currentUser.isBanned) {
    throw new Error(`Tài khoản của bạn đã bị khóa đến ngày ${new Date(currentUser.banUntil || '').toLocaleDateString('vi-VN')} do vi phạm điều khoản quy định (strikes > 5).`);
  }

  // 1. Call AI Anti-Seeding endpoint
  let aiAnalysis: AIAnalysisResult;
  try {
    const res = await fetch('/api/ai/analyze-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewContent: content, placeName, rating }),
    });
    if (!res.ok) throw new Error('Không thể kết nối đến AI Trọng tài.');
    aiAnalysis = await res.json();
  } catch (err: any) {
    console.warn('Falling back to local AI analysis:', err);
    // Local pattern fallback if network error
    const isSeeding = /0\d{9}|hotline|inbox|giảm giá|quảng cáo|liên hệ|dịch vụ uy tín/i.test(content);
    aiAnalysis = {
      isSeeding,
      seedingReason: isSeeding
        ? 'AI Anti-Seeding: Phát hiện số điện thoại chốt đơn, nội dung quảng cáo rác.'
        : 'Nội dung đánh giá tự nhiên.',
      confidenceScore: isSeeding ? 90 : 98,
      detectedKeywords: isSeeding ? ['quảng cáo'] : [],
      recommendedAction: isSeeding ? 'FLAGGED_WARNING' : 'APPROVED',
    };
  }

  // 2. Create review object
  const newReview: Review = {
    reviewId: 'rev_' + Date.now(),
    placeId,
    userId: currentUser.uid,
    userName: currentUser.username,
    userAvatar: currentUser.avatar,
    rating,
    content,
    createdAt: new Date().toISOString(),
    isSeeding: aiAnalysis.isSeeding,
    seedingReason: aiAnalysis.seedingReason,
    confidenceScore: aiAnalysis.confidenceScore,
    detectedKeywords: aiAnalysis.detectedKeywords,
  };

  const reviews = getReviews();
  reviews.unshift(newReview);
  localStorage.setItem(STORAGE_KEYS.REVIEWS, JSON.stringify(reviews));

  // 3. Handle User Strike Penalties if AI flagged Seeding
  let userStatusUpdated: User | null = null;
  if (aiAnalysis.isSeeding) {
    currentUser.strikes += 1;
    if (currentUser.strikes > 5) {
      const banDate = new Date();
      banDate.setDate(banDate.getDate() + 180);
      currentUser.isBanned = true;
      currentUser.banUntil = banDate.toISOString();
    }
    updateUser(currentUser);
    userStatusUpdated = currentUser;
  }

  return {
    review: newReview,
    aiAnalysis,
    userStatusUpdated,
  };
}

// Reset store to demo defaults
export function resetDemoData() {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
  localStorage.setItem(STORAGE_KEYS.PLACES, JSON.stringify(INITIAL_PLACES));
  localStorage.setItem(STORAGE_KEYS.REVIEWS, JSON.stringify(INITIAL_REVIEWS));
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, 'guest');
}
