import { supabase } from './supabaseClient';
import { INITIAL_PLACES, INITIAL_REVIEWS, INITIAL_USERS } from '../data/initialData';
import { AIAnalysisResult, Place, Review, User } from '../types';

const STORAGE_PLACES_KEY = 'veritrip_places_v3';
const STORAGE_REVIEWS_KEY = 'veritrip_reviews_v3';

function getStoredPlaces(): Place[] {
  try {
    const raw = localStorage.getItem(STORAGE_PLACES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading places from localStorage', e);
  }
  return [...INITIAL_PLACES];
}

function saveStoredPlaces(places: Place[]): void {
  try {
    localStorage.setItem(STORAGE_PLACES_KEY, JSON.stringify(places));
  } catch (e) {
    console.warn('Error saving places to localStorage', e);
  }
}

// Fallback initial data in memory if Supabase returns empty / disconnected
let memoryUsers: User[] = [...INITIAL_USERS];
let memoryPlaces: Place[] = getStoredPlaces();
let memoryReviews: Review[] = [...INITIAL_REVIEWS];
let currentSessionUserId: string | null = null;

// Helper mapping functions between Supabase DB rows and App Interfaces
function mapRowToUser(row: any): User {
  return {
    uid: row.id || row.uid,
    email: row.email,
    username: row.username || row.email?.split('@')[0] || 'User',
    avatar: row.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(row.email || 'user')}`,
    strikes: row.strikes ?? 0,
    isBanned: row.is_banned ?? row.isBanned ?? false,
    banUntil: row.ban_until || row.banUntil || null,
    role: row.role || 'user',
  };
}

function mapRowToPlace(row: any): Place {
  const imageUrl = row.image || row.imageUrl || row.image_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80';
  return {
    placeId: row.id || row.placeId,
    name: row.name,
    category: row.category || 'Địa điểm du lịch',
    address: row.address || '',
    imageUrl: imageUrl,
    description: row.description || '',
    phone: row.phone || '',
    location: typeof row.location === 'string' ? JSON.parse(row.location) : (row.location || { lat: 15.3405, lng: 108.9212 }),
    averageRating: Number(row.average_rating ?? row.averageRating ?? 5.0),
    reviewCount: Number(row.review_count ?? row.reviewCount ?? 0),
    trustScore: Number(row.trust_score ?? row.trustScore ?? 100),
    addedBy: row.added_by || row.addedBy || 'Thành viên cộng đồng',
    googleMapsUrl: row.google_maps_url || row.googleMapsUrl || '',
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
  };
}

function mapRowToReview(row: any): Review {
  return {
    reviewId: row.id || row.reviewId,
    placeId: row.place_id || row.placeId,
    userId: row.user_id || row.userId,
    userName: row.user_name || row.userName,
    userAvatar: row.user_avatar || row.userAvatar,
    rating: Number(row.rating),
    content: row.content,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    isSeeding: row.is_seeding ?? row.isSeeding ?? false,
    seedingReason: row.seeding_reason || row.seedingReason || '',
    confidenceScore: Number(row.confidence_score ?? row.confidenceScore ?? 100),
    detectedKeywords: row.detected_keywords || row.detectedKeywords || [],
  };
}

// -------------------------------------------------------------
// USER / AUTH METHODS (SUPABASE)
// -------------------------------------------------------------

export async function getUsers(): Promise<User[]> {
  try {
    const { data, error } = await supabase.from('users').select('*');
    if (!error && data && data.length > 0) {
      return data.map(mapRowToUser);
    }
  } catch (err) {
    console.warn('Error fetching users from Supabase:', err);
  }
  return memoryUsers;
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const activeUid = session?.user?.id || currentSessionUserId;

    if (!activeUid) return null;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', activeUid)
      .maybeSingle();

    if (!error && data) {
      const user = mapRowToUser(data);
      if (user.strikes > 5 && !user.isBanned) {
        const banDate = new Date();
        banDate.setDate(banDate.getDate() + 180);
        user.isBanned = true;
        user.banUntil = banDate.toISOString();
        await updateUser(user);
      }
      return user;
    }
  } catch (err) {
    console.warn('Supabase getCurrentUser notice:', err);
  }

  if (!currentSessionUserId) return null;
  return memoryUsers.find((u) => u.uid === currentSessionUserId) || null;
}

export async function setCurrentUserId(uid: string): Promise<void> {
  currentSessionUserId = uid;
}

export async function logoutUser(): Promise<void> {
  currentSessionUserId = null;
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('Supabase signOut notice:', err);
  }
}

export async function loginUser(email: string, password?: string): Promise<User> {
  const normalizedEmail = email.trim().toLowerCase();
  const pwd = password || '123456';

  let supabaseAuthUser: any = null;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: pwd,
    });

    if (error) {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: pwd,
        options: {
          data: {
            username: normalizedEmail.split('@')[0],
          },
        },
      });
      if (!signUpError && signUpData.user) {
        supabaseAuthUser = signUpData.user;
      }
    } else {
      supabaseAuthUser = data.user;
    }
  } catch (err) {
    console.warn('Supabase auth sign-in notice:', err);
  }

  const users = await getUsers();
  let user = users.find((u) => u.email.toLowerCase() === normalizedEmail);

  if (!user) {
    const uid = supabaseAuthUser?.id || 'user_' + Date.now();
    const username = normalizedEmail.split('@')[0];
    user = {
      uid,
      email: normalizedEmail,
      username: username.charAt(0).toUpperCase() + username.slice(1),
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`,
      strikes: 0,
      isBanned: false,
      banUntil: null,
      role: 'user',
    };
    await updateUser(user);
  }

  currentSessionUserId = user.uid;
  return user;
}

export async function registerUser(data: {
  username: string;
  email: string;
  password?: string;
  avatar?: string;
}): Promise<User> {
  const normalizedEmail = data.email.trim().toLowerCase();
  const pwd = data.password || '123456';

  const users = await getUsers();
  const existing = users.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (existing) {
    throw new Error('Email này đã được đăng ký. Vui lòng chuyển sang tab Đăng nhập.');
  }

  let uid = 'user_' + Date.now();
  try {
    const { data: authData, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: pwd,
      options: {
        data: {
          username: data.username.trim(),
          avatar: data.avatar,
        },
      },
    });

    if (!error && authData.user) {
      uid = authData.user.id;
    }
  } catch (err) {
    console.warn('Supabase auth signUp notice:', err);
  }

  const newUser: User = {
    uid,
    email: normalizedEmail,
    username: data.username.trim(),
    avatar:
      data.avatar ||
      `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
    strikes: 0,
    isBanned: false,
    banUntil: null,
    role: 'user',
  };

  await updateUser(newUser);
  currentSessionUserId = newUser.uid;
  return newUser;
}

export async function updateUser(updatedUser: User): Promise<void> {
  const idx = memoryUsers.findIndex((u) => u.uid === updatedUser.uid);
  if (idx !== -1) {
    memoryUsers[idx] = updatedUser;
  } else {
    memoryUsers.push(updatedUser);
  }

  try {
    await supabase.from('users').upsert({
      id: updatedUser.uid,
      email: updatedUser.email,
      username: updatedUser.username,
      avatar: updatedUser.avatar,
      strikes: updatedUser.strikes,
      is_banned: updatedUser.isBanned,
      ban_until: updatedUser.banUntil,
      role: updatedUser.role,
    });
  } catch (err) {
    console.warn('Supabase updateUser error:', err);
  }
}

// -------------------------------------------------------------
// PLACES METHODS (SUPABASE)
// -------------------------------------------------------------

export async function syncAllPlacesToSupabase(placesToSync?: Place[]): Promise<void> {
  const targetPlaces = placesToSync || memoryPlaces;
  if (!targetPlaces || targetPlaces.length === 0) return;

  const rows = targetPlaces.map((p) => ({
    id: p.placeId,
    name: p.name,
    category: p.category || 'Địa điểm du lịch',
    address: p.address || '',
    description: p.description || '',
    phone: p.phone || '',
    image: p.imageUrl,
    location: typeof p.location === 'object' ? JSON.stringify(p.location) : p.location,
    average_rating: p.averageRating,
    review_count: p.reviewCount,
    trust_score: p.trustScore,
    added_by: p.addedBy || 'Thành viên cộng đồng',
    google_maps_url: p.googleMapsUrl || '',
    created_at: p.createdAt || new Date().toISOString(),
  }));

  try {
    const { error } = await supabase.from('places').upsert(rows, { onConflict: 'id' });
    if (error) {
      console.warn('Sync places to Supabase error:', error.message || error);
    } else {
      console.log(`Successfully synced ${rows.length} places to Supabase places table.`);
    }
  } catch (err) {
    console.warn('Failed to sync places to Supabase:', err);
  }
}

export async function getPlaces(): Promise<Place[]> {
  let places: Place[] = memoryPlaces;

  // Make sure initial places and local memory places are synced to Supabase
  syncAllPlacesToSupabase(memoryPlaces).catch(() => {});

  try {
    const { data, error } = await supabase.from('places').select('*');
    if (!error && data && data.length > 0) {
      const dbPlaces = data.map(mapRowToPlace);
      const placeMap = new Map<string, Place>();
      memoryPlaces.forEach((p) => placeMap.set(p.placeId, p));
      dbPlaces.forEach((p) => placeMap.set(p.placeId, p));
      places = Array.from(placeMap.values());
      memoryPlaces = places;
      saveStoredPlaces(places);
    } else {
      // If Supabase table is empty or error, push initial places into Supabase
      await syncAllPlacesToSupabase(INITIAL_PLACES);
    }
  } catch (err) {
    console.warn('Error fetching places directly from Supabase:', err);
    places = memoryPlaces;
  }

  const reviews = await getReviews();

  return places.map((place) => {
    const placeReviews = reviews.filter((r) => r.placeId === place.placeId);
    if (placeReviews.length === 0) return place;

    const cleanReviews = placeReviews.filter((r) => !r.isSeeding);
    const avgRating =
      cleanReviews.length > 0
        ? Number((cleanReviews.reduce((sum, r) => sum + r.rating, 0) / cleanReviews.length).toFixed(1))
        : place.averageRating;

    const trustScore = Math.max(
      0,
      Math.round(((placeReviews.length - (placeReviews.length - cleanReviews.length)) / placeReviews.length) * 100)
    );

    return {
      ...place,
      reviewCount: placeReviews.length,
      averageRating: avgRating,
      trustScore,
    };
  });
}

export async function addPlace(
  newPlaceData: Omit<Place, 'placeId' | 'reviewCount' | 'createdAt' | 'trustScore' | 'averageRating'>
): Promise<Place> {
  const placeId = 'place_' + Date.now();
  const newPlace: Place = {
    ...newPlaceData,
    placeId,
    averageRating: 5.0,
    reviewCount: 0,
    createdAt: new Date().toISOString(),
    trustScore: 100,
  };

  memoryPlaces.unshift(newPlace);
  saveStoredPlaces(memoryPlaces);

  try {
    await supabase.from('places').upsert({
      id: placeId,
      name: newPlace.name,
      category: newPlace.category,
      address: newPlace.address,
      description: newPlace.description || '',
      phone: newPlace.phone || '',
      image: newPlace.imageUrl,
      location: typeof newPlace.location === 'object' ? JSON.stringify(newPlace.location) : newPlace.location,
      average_rating: newPlace.averageRating,
      review_count: newPlace.reviewCount,
      trust_score: newPlace.trustScore,
      added_by: newPlace.addedBy,
      google_maps_url: newPlace.googleMapsUrl || '',
      created_at: newPlace.createdAt,
    });
  } catch (err) {
    console.warn('Supabase addPlace error:', err);
  }

  return newPlace;
}

export async function updatePlace(updatedPlace: Place): Promise<Place> {
  const index = memoryPlaces.findIndex((p) => p.placeId === updatedPlace.placeId);
  if (index !== -1) {
    memoryPlaces[index] = { ...memoryPlaces[index], ...updatedPlace };
  } else {
    memoryPlaces.unshift(updatedPlace);
  }
  saveStoredPlaces(memoryPlaces);

  try {
    await supabase.from('places').upsert({
      id: updatedPlace.placeId,
      name: updatedPlace.name,
      category: updatedPlace.category,
      address: updatedPlace.address,
      description: updatedPlace.description || '',
      phone: updatedPlace.phone || '',
      image: updatedPlace.imageUrl,
      location: typeof updatedPlace.location === 'object' ? JSON.stringify(updatedPlace.location) : updatedPlace.location,
      average_rating: updatedPlace.averageRating,
      review_count: updatedPlace.reviewCount,
      trust_score: updatedPlace.trustScore,
      added_by: updatedPlace.addedBy || 'Thành viên cộng đồng',
      google_maps_url: updatedPlace.googleMapsUrl || '',
      created_at: updatedPlace.createdAt,
    });
  } catch (err) {
    console.warn('Supabase updatePlace error:', err);
  }

  return updatedPlace;
}

// -------------------------------------------------------------
// REVIEWS METHODS (SUPABASE)
// -------------------------------------------------------------

export async function getReviews(placeId?: string): Promise<Review[]> {
  let reviews: Review[] = [];

  try {
    const { data, error } = await supabase.from('reviews').select('*');
    if (!error && data && data.length > 0) {
      reviews = data.map(mapRowToReview);
    } else {
      reviews = memoryReviews;
    }
  } catch (err) {
    console.warn('Error fetching reviews directly from Supabase:', err);
    reviews = memoryReviews;
  }

  reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    throw new Error('Bạn cần đăng nhập để gửi đánh giá.');
  }

  if (currentUser.isBanned) {
    throw new Error(
      `Tài khoản của bạn đã bị khóa đến ngày ${new Date(
        currentUser.banUntil || ''
      ).toLocaleDateString('vi-VN')} do vi phạm điều khoản quy định (strikes > 5).`
    );
  }

  // 1. Call AI Anti-Seeding API
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

  // 2. Create review object & save to Supabase
  const reviewId = 'rev_' + Date.now();
  const newReview: Review = {
    reviewId,
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

  memoryReviews.unshift(newReview);

  try {
    await supabase.from('reviews').insert({
      id: reviewId,
      place_id: placeId,
      user_id: currentUser.uid.includes('user_') ? null : currentUser.uid,
      user_name: currentUser.username,
      user_avatar: currentUser.avatar,
      rating,
      content,
      is_seeding: aiAnalysis.isSeeding,
      seeding_reason: aiAnalysis.seedingReason,
      confidence_score: aiAnalysis.confidenceScore,
      detected_keywords: aiAnalysis.detectedKeywords,
      created_at: newReview.createdAt,
    });
  } catch (err) {
    console.warn('Supabase submitReview error:', err);
  }

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
    await updateUser(currentUser);
    userStatusUpdated = currentUser;
  }

  return {
    review: newReview,
    aiAnalysis,
    userStatusUpdated,
  };
}

// Reset store to demo defaults
export async function resetDemoData(): Promise<void> {
  memoryUsers = [...INITIAL_USERS];
  memoryPlaces = [...INITIAL_PLACES];
  memoryReviews = [...INITIAL_REVIEWS];
  currentSessionUserId = null;
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('Reset error:', err);
  }
}
