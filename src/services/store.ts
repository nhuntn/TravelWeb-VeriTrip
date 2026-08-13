import { supabase, isSupabaseConfigured } from './supabaseClient';
import { INITIAL_PLACES, INITIAL_REVIEWS, INITIAL_USERS } from '../data/initialData';
import { AIAnalysisResult, Place, Review, User } from '../types';

const STORAGE_PLACES_KEY = 'veritrip_places_v4';
const STORAGE_REVIEWS_KEY = 'veritrip_reviews_v4';
const SEEDED_MARKER_KEY = 'veritrip_has_seeded_v1';

function hasSeededBefore(): boolean {
  try {
    return localStorage.getItem(SEEDED_MARKER_KEY) === 'true';
  } catch (e) {
    return false;
  }
}

function markAsSeeded(): void {
  try {
    localStorage.setItem(SEEDED_MARKER_KEY, 'true');
  } catch (e) {
    console.warn('Error marking seed status in localStorage', e);
  }
}

const LEGACY_KEYS = [
  'veritrip_places_v3',
  'veritrip_reviews_v3',
  'veritrip_places_v2',
  'veritrip_reviews_v2',
  'veritrip_places',
   'veritrip_reviews',
];
function clearLegacyLocalStorage(): void {
 try {
    LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch (e) {
    console.warn('Error clearing legacy localStorage keys', e);
  }
}
clearLegacyLocalStorage();

function getStoredPlaces(): Place[] {
  try {
    const raw = localStorage.getItem(STORAGE_PLACES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((p: Place) => ({
          ...p,
          addedBy: (!p.addedBy || p.addedBy.startsWith('user_demo')) ? 'Thành viên cộng đồng' : p.addedBy,
        }));
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

function getStoredReviews(): Review[] {
  try {
    const raw = localStorage.getItem(STORAGE_REVIEWS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((r: Review) => ({
          ...r,
          userId: (!r.userId || r.userId.startsWith('user_demo') || r.userId.startsWith('user_seeder')) ? 'community_member' : r.userId,
          userName: (r.userName === 'An Nguyễn (Traveler)' || r.userName === 'Chốt Đơn Booking' || r.userName === 'Lê Hoàng' || r.userName === 'Marketing Team') ? 'Thành viên cộng đồng' : r.userName,
        }));
      }
    }
  } catch (e) {
    console.warn('Error reading reviews from localStorage', e);
  }
  return [...INITIAL_REVIEWS];
}

function saveStoredReviews(reviews: Review[]): void {
  try {
    localStorage.setItem(STORAGE_REVIEWS_KEY, JSON.stringify(reviews));
  } catch (e) {
    console.warn('Error saving reviews to localStorage', e);
  }
}

// Helper to check for standard UUID string format
function isValidUUID(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
}

// Fallback initial data in memory if Supabase returns empty / disconnected
let memoryUsers: User[] = [...INITIAL_USERS];
let memoryPlaces: Place[] = getStoredPlaces();
let memoryReviews: Review[] = getStoredReviews();
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
    ownerId: row.owner_id || row.ownerId,
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
    addedBy: row.added_by_name || row.addedBy || 'Thành viên cộng đồng',
    addedByUid: row.added_by || row.addedByUid || null,
    googleMapsUrl: row.google_maps_url || row.googleMapsUrl || '',
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
  };
}

function mapRowToReview(row: any): Review {
  const uid = row.user_id || row.userId;
  const linkedUser = row.users || row.user || null;
  return {
    reviewId: row.id || row.reviewId,
    placeId: row.place_id || row.placeId,
    userId: uid,
    userName: linkedUser?.username || row.user_name || row.userName || 'Người dùng ẩn danh',
    userAvatar: linkedUser?.avatar || row.user_avatar || row.userAvatar,
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
  if (!isSupabaseConfigured) return memoryUsers;
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
  if (!isSupabaseConfigured) {
    if (!currentSessionUserId) return null;
    return memoryUsers.find((u) => u.uid === currentSessionUserId) || null;
  }
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
    } else if (session?.user) {
      const email = session.user.email || '';
      const rawUsername = email.split('@')[0] || 'User';
      const user: User = {
        uid: session.user.id,
        email,
        username: session.user.user_metadata?.username || (rawUsername.charAt(0).toUpperCase() + rawUsername.slice(1)),
        avatar: session.user.user_metadata?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(rawUsername)}`,
        strikes: 0,
        isBanned: false,
        banUntil: null,
        role: 'user',
      };
      await updateUser(user);
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
  if (!isSupabaseConfigured) return;
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('Supabase signOut notice:', err);
  }
}

export async function loginUser(email: string, password?: string): Promise<User> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!password || !password.trim()) {
    throw new Error('Vui lòng nhập mật khẩu.');
  }
  const pwd = password.trim();

  let supabaseAuthUser: any = null;

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: pwd,
      });

      if (error) {
        const msg = error.message?.toLowerCase() || '';
        if (msg.includes('invalid login credentials')) {
          throw new Error('Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.');
        }
        if (msg.includes('email not confirmed')) {
          throw new Error('Email chưa được xác nhận. Vui lòng kiểm tra hộp thư email hoặc tắt "Confirm email" trong cài đặt Supabase Auth.');
        }
        if (msg.includes('too many requests') || msg.includes('rate limit')) {
          throw new Error('Bạn đã thử quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.');
        }
        throw new Error(error.message || 'Lỗi đăng nhập qua Supabase Auth.');
      }
      supabaseAuthUser = data.user;
    } catch (err: any) {
      throw new Error(err.message || 'Không thể kết nối máy chủ xác thực. Vui lòng thử lại.');
    }
  }

  const users = await getUsers();
  let user = users.find((u) => u.email.toLowerCase() === normalizedEmail);

  if (user) {
    if (supabaseAuthUser?.id && user.uid !== supabaseAuthUser.id) {
      user.uid = supabaseAuthUser.id;
      await updateUser(user);
    }
  } else if (supabaseAuthUser) {
    const username = normalizedEmail.split('@')[0];
    user = {
      uid: supabaseAuthUser.id,
      email: normalizedEmail,
      username: username.charAt(0).toUpperCase() + username.slice(1),
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`,
      strikes: 0,
      isBanned: false,
      banUntil: null,
      role: 'user',
    };
    await updateUser(user);
  } else if (!isSupabaseConfigured) {
    // Demo local auth fallback
    const username = normalizedEmail.split('@')[0];
    user = {
      uid: 'usr_' + crypto.randomUUID(),
      email: normalizedEmail,
      username: username.charAt(0).toUpperCase() + username.slice(1),
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`,
      strikes: 0,
      isBanned: false,
      banUntil: null,
      role: 'user',
    };
    memoryUsers.push(user);
  } else {
    throw new Error('Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại thông tin.');
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
  const pwd = data.password ? data.password.trim() : '';
  if (!pwd || pwd.length < 6) {
    throw new Error('Mật khẩu phải chứa ít nhất 6 ký tự.');
  }

  const users = await getUsers();
  const existing = users.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (existing) {
    throw new Error('Email này đã được đăng ký. Vui lòng chuyển sang tab Đăng nhập.');
  }

  let uid: string | null = null;
  if (isSupabaseConfigured) {
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

      if (error) {
        const msg = error.message?.toLowerCase() || '';
        if (msg.includes('already registered') || msg.includes('user_already_exists') || msg.includes('already exists')) {
          throw new Error('Email này đã được đăng ký. Vui lòng chuyển sang tab Đăng nhập.');
        }
        if (msg.includes('password should be at least')) {
          throw new Error('Mật khẩu phải chứa ít nhất 6 ký tự.');
        }
        if (msg.includes('invalid email')) {
          throw new Error('Địa chỉ Email không hợp lệ.');
        }
        throw new Error(error.message || 'Lỗi khi đăng ký với Supabase Auth.');
      }

      if (authData.user) {
        if (authData.user.identities && authData.user.identities.length === 0) {
          throw new Error('Email này đã được đăng ký. Vui lòng chuyển sang tab Đăng nhập.');
        }
        uid = authData.user.id;
      }
    } catch (err: any) {
      throw new Error(err.message || 'Không thể đăng ký tài khoản qua Supabase Auth.');
    }
  } else {
    // Local fallback UID
    uid = 'usr_' + crypto.randomUUID();
  }

  if (!uid) {
    throw new Error('Đăng ký thất bại: Không tạo được ID người dùng hợp lệ.');
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
  // Sanitize via server endpoint to prevent privilege escalation
  if (isSupabaseConfigured) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/users/update-profile', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          uid: updatedUser.uid,
          email: updatedUser.email,
          username: updatedUser.username,
          avatar: updatedUser.avatar,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.profile) {
          updatedUser.username = data.profile.username;
          updatedUser.avatar = data.profile.avatar;
        }
      }
    } catch (e) {
      // Continue with local update if offline
    }
  }

  const idx = memoryUsers.findIndex((u) => u.uid === updatedUser.uid || u.email.toLowerCase() === updatedUser.email.toLowerCase());
  if (idx !== -1) {
    memoryUsers[idx] = updatedUser;
  } else {
    memoryUsers.push(updatedUser);
  }

  if (!isSupabaseConfigured) return;

  // Only attempt upsert to public.users if updatedUser.uid is a valid UUID to prevent FK errors with auth.users
  if (!isValidUUID(updatedUser.uid)) {
    console.warn('Bỏ qua upsert Supabase users do UID không phải dạng UUID:', updatedUser.uid);
    return;
  }

  try {
    await supabase.from('users').upsert({
      id: updatedUser.uid,
      email: updatedUser.email,
      username: updatedUser.username,
      avatar: updatedUser.avatar,
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('Supabase updateUser error:', err);
  }
}

// -------------------------------------------------------------
// PLACES METHODS (SUPABASE)
// -------------------------------------------------------------

async function safeUpsertPlaces(rows: any[]) {
  if (!isSupabaseConfigured || !rows || rows.length === 0) return;
  const { error } = await supabase.from('places').upsert(rows, { onConflict: 'id' });
  if (error) {
    if (error.message?.includes('owner_id') || error.code === 'PGRST204' || String(error.message).includes('column')) {
      const rowsWithoutOwner = rows.map(({ owner_id, ...rest }) => rest);
      const { error: retryErr } = await supabase.from('places').upsert(rowsWithoutOwner, { onConflict: 'id' });
      if (retryErr) {
        console.warn('Sync places retry error:', retryErr.message || retryErr);
      }
    } else {
      console.warn('Sync places error:', error.message || error);
    }
  }
}

export async function syncAllPlacesToSupabase(placesToSync?: Place[]): Promise<void> {
  if (!isSupabaseConfigured) return;
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
    added_by: p.addedByUid && isValidUUID(p.addedByUid) ? p.addedByUid : null,
    added_by_name: p.addedBy || 'Thành viên cộng đồng',
    owner_id: p.ownerId && isValidUUID(p.ownerId) ? p.ownerId : (isValidUUID(currentSessionUserId || '') ? currentSessionUserId : null),
    google_maps_url: p.googleMapsUrl || '',
    created_at: p.createdAt || new Date().toISOString(),
  }));

  try {
    await safeUpsertPlaces(rows);
  } catch (err) {
    console.warn('Failed to sync places to Supabase:', err);
  }
}

export async function getPlaces(): Promise<Place[]> {
  let places: Place[] = memoryPlaces;

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('places').select('*');
      if (!error && data && data.length > 0) {
        places = data.map(mapRowToPlace);
        memoryPlaces = places;
        saveStoredPlaces(places);
      } else if (!error && (!data || data.length === 0)) {
        if (!hasSeededBefore()) {
          await syncAllPlacesToSupabase(INITIAL_PLACES);
          places = INITIAL_PLACES;
          memoryPlaces = places;
          saveStoredPlaces(places);
          markAsSeeded();
        } else {
          places = [];
          memoryPlaces = [];
          saveStoredPlaces([]);
        }
      }
    } catch (err) {
      console.warn('Error fetching places directly from Supabase:', err);
      places = memoryPlaces;
    }
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
      Math.round((cleanReviews.length / placeReviews.length) * 100)
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
  newPlaceData: Omit<Place, 'placeId' | 'reviewCount' | 'createdAt' | 'trustScore' | 'averageRating'>,
  currentUserUid?: string
): Promise<Place> {
  const currentUser = await getCurrentUser();
  const effectiveUid = (currentUserUid && isValidUUID(currentUserUid))
    ? currentUserUid
    : (currentUser?.uid && isValidUUID(currentUser.uid) ? currentUser.uid : null);

  const placeId = 'place_' + crypto.randomUUID();
  const addedByName = newPlaceData.addedBy || currentUser?.username || 'Thành viên cộng đồng';

  const newPlace: Place = {
    ...newPlaceData,
    placeId,
    averageRating: 5.0,
    reviewCount: 0,
    createdAt: new Date().toISOString(),
    trustScore: 100,
    addedBy: addedByName,
    addedByUid: effectiveUid || newPlaceData.addedByUid || null,
    ownerId: newPlaceData.ownerId || (effectiveUid || undefined),
  };

  memoryPlaces.unshift(newPlace);
  saveStoredPlaces(memoryPlaces);

  try {
    await safeUpsertPlaces([{
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
      added_by: effectiveUid,
      added_by_name: addedByName,
      owner_id: effectiveUid,
      google_maps_url: newPlace.googleMapsUrl || '',
      created_at: newPlace.createdAt,
    }]);
  } catch (err) {
    console.warn('Supabase addPlace error:', err);
  }

  return newPlace;
}

export async function updatePlace(updatedPlace: Place, currentUserUid?: string): Promise<Place> {
  const currentUser = await getCurrentUser();
  const effectiveUid = (currentUserUid && isValidUUID(currentUserUid))
    ? currentUserUid
    : (currentUser?.uid && isValidUUID(currentUser.uid) ? currentUser.uid : null);

  const addedByUid = updatedPlace.addedByUid || effectiveUid;
  const ownerId = updatedPlace.ownerId || (effectiveUid || undefined);
  const placeToSave: Place = { ...updatedPlace, ownerId, addedByUid };

  const index = memoryPlaces.findIndex((p) => p.placeId === placeToSave.placeId);
  if (index !== -1) {
    memoryPlaces[index] = { ...memoryPlaces[index], ...placeToSave };
  } else {
    memoryPlaces.unshift(placeToSave);
  }
  saveStoredPlaces(memoryPlaces);

  try {
    await safeUpsertPlaces([{
      id: placeToSave.placeId,
      name: placeToSave.name,
      category: placeToSave.category,
      address: placeToSave.address,
      description: placeToSave.description || '',
      phone: placeToSave.phone || '',
      image: placeToSave.imageUrl,
      location: typeof placeToSave.location === 'object' ? JSON.stringify(placeToSave.location) : placeToSave.location,
      average_rating: placeToSave.averageRating,
      review_count: placeToSave.reviewCount,
      trust_score: placeToSave.trustScore,
      added_by: addedByUid && isValidUUID(addedByUid) ? addedByUid : null,
      added_by_name: placeToSave.addedBy || 'Thành viên cộng đồng',
      owner_id: ownerId && isValidUUID(ownerId) ? ownerId : null,
      google_maps_url: placeToSave.googleMapsUrl || '',
      created_at: placeToSave.createdAt,
    }]);
  } catch (err) {
    console.warn('Supabase updatePlace error:', err);
  }

  return placeToSave;
}

// -------------------------------------------------------------
// REVIEWS METHODS (SUPABASE & LOCAL STORAGE)
// -------------------------------------------------------------

export async function syncAllReviewsToSupabase(reviewsToSync?: Review[]): Promise<void> {
  if (!isSupabaseConfigured) return;
  const targetReviews = reviewsToSync || memoryReviews;
  if (!targetReviews || targetReviews.length === 0) return;

  const rows = targetReviews.map((r) => ({
    id: r.reviewId,
    place_id: r.placeId,
    user_id: isValidUUID(r.userId) ? r.userId : null,
    user_name: r.userName,
    user_avatar: r.userAvatar,
    rating: r.rating,
    content: r.content,
    is_seeding: r.isSeeding,
    seeding_reason: r.seedingReason || '',
    confidence_score: r.confidenceScore || 100,
    detected_keywords: r.detectedKeywords || [],
    created_at: r.createdAt || new Date().toISOString(),
  }));

  try {
    const { error } = await supabase.from('reviews').upsert(rows, { onConflict: 'id' });
    if (error) {
      console.warn('Sync reviews to Supabase notice:', error.message || error);
    }
  } catch (err) {
    console.warn('Failed to sync reviews to Supabase:', err);
  }
}

export async function getReviews(placeId?: string): Promise<Review[]> {
  let reviews: Review[] = memoryReviews;

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*, users:user_id(username, avatar)');
      if (!error && data && data.length > 0) {
        reviews = data.map(mapRowToReview);
        memoryReviews = reviews;
        saveStoredReviews(reviews);
      } else if (!error && (!data || data.length === 0)) {
        // Chỉ seed dữ liệu mẫu khi bảng Supabase THỰC SỰ rỗng VÀ chưa từng seed trước đó
        if (!hasSeededBefore()) {
          await syncAllReviewsToSupabase(INITIAL_REVIEWS);
          reviews = INITIAL_REVIEWS;
          memoryReviews = reviews;
          saveStoredReviews(reviews);
          markAsSeeded();
        } else {
          reviews = [];
          memoryReviews = [];
          saveStoredReviews([]);
        }
      }
    } catch (err) {
      console.warn('Error fetching reviews directly from Supabase:', err);
      reviews = memoryReviews;
    }
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

  let token: string | undefined = undefined;
  if (isSupabaseConfigured) {
    const { data: sessionData } = await supabase.auth.getSession();
    token = sessionData?.session?.access_token;
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let review: Review;
  let aiAnalysis: AIAnalysisResult;
  let userStatusUpdated: User | null = null;

  try {
    const res = await fetch('/api/reviews/submit', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        placeId,
        placeName,
        rating,
        content,
        userId: currentUser.uid,
        userName: currentUser.username,
        userAvatar: currentUser.avatar,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      aiAnalysis = data.aiAnalysis;
      review = {
        reviewId: data.review.id,
        placeId: data.review.place_id,
        userId: data.review.user_id,
        userName: data.review.user_name,
        userAvatar: data.review.user_avatar,
        rating: data.review.rating,
        content: data.review.content,
        createdAt: data.review.created_at,
        isSeeding: data.review.is_seeding,
        seedingReason: data.review.seeding_reason,
        confidenceScore: data.review.confidence_score,
        detectedKeywords: data.review.detected_keywords,
      };

      if (data.userPenalty) {
        currentUser.strikes = data.userPenalty.strikes;
        currentUser.isBanned = data.userPenalty.isBanned;
        currentUser.banUntil = data.userPenalty.banUntil;
        userStatusUpdated = currentUser;
      }
    } else {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Lỗi gửi đánh giá lên máy chủ');
    }
  } catch (err: any) {
    console.warn('Falling back to local AI review submission:', err);
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

    const reviewId = 'rev_' + crypto.randomUUID();
    review = {
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

    if (isSupabaseConfigured) {
      try {
        await supabase.from('reviews').upsert({
          id: reviewId,
          place_id: placeId,
          user_id: isValidUUID(currentUser.uid) ? currentUser.uid : null,
          user_name: currentUser.username,
          user_avatar: currentUser.avatar,
          rating,
          content,
          is_seeding: aiAnalysis.isSeeding,
          seeding_reason: aiAnalysis.seedingReason,
          confidence_score: aiAnalysis.confidenceScore,
          detected_keywords: aiAnalysis.detectedKeywords,
          created_at: review.createdAt,
        });

        if (aiAnalysis.isSeeding && currentUser.uid && isValidUUID(currentUser.uid)) {
          const { data: dbUser } = await supabase
            .from('users')
            .select('strikes, is_banned, ban_until')
            .eq('id', currentUser.uid)
            .maybeSingle();

          if (dbUser) {
            currentUser.strikes = dbUser.strikes ?? currentUser.strikes;
            currentUser.isBanned = dbUser.is_banned ?? currentUser.isBanned;
            currentUser.banUntil = dbUser.ban_until ?? currentUser.banUntil;
            userStatusUpdated = { ...currentUser };
          }
        }
      } catch (sErr) {
        console.warn('Supabase fallback submitReview error:', sErr);
      }
    }
  }

  memoryReviews.unshift(review);
  saveStoredReviews(memoryReviews);

  return {
    review,
    aiAnalysis,
    userStatusUpdated,
  };
}

// Reset store to demo defaults
export async function resetDemoData(): Promise<void> {
  memoryUsers = [...INITIAL_USERS];
  memoryPlaces = [...INITIAL_PLACES];
  memoryReviews = [...INITIAL_REVIEWS];
  saveStoredPlaces(memoryPlaces);
  saveStoredReviews(memoryReviews);
  currentSessionUserId = null;
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('Reset error:', err);
  }
}
