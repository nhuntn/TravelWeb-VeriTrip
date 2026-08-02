import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { INITIAL_PLACES, INITIAL_REVIEWS, INITIAL_USERS } from '../data/initialData';
import { AIAnalysisResult, Place, Review, User } from '../types';

// 1. Initialize Firebase App using Environment Variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'travelweb-demo.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'travelweb-demo',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'travelweb-demo.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789012',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:123456789012:web:abcdef123456',
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

// 2. Collections Setup
const USERS_COL = 'users';
const PLACES_COL = 'places';
const REVIEWS_COL = 'reviews';

let currentSessionUserId: string | null = 'guest';

// Helper to auto-seed initial data to Firestore if collection is empty
export async function seedInitialDataIfEmpty(): Promise<void> {
  try {
    const placesSnap = await getDocs(collection(db, PLACES_COL));
    if (placesSnap.empty) {
      for (const place of INITIAL_PLACES) {
        await setDoc(doc(db, PLACES_COL, place.placeId), place);
      }
    }
    const usersSnap = await getDocs(collection(db, USERS_COL));
    if (usersSnap.empty) {
      for (const user of INITIAL_USERS) {
        await setDoc(doc(db, USERS_COL, user.uid), user);
      }
    }
    const reviewsSnap = await getDocs(collection(db, REVIEWS_COL));
    if (reviewsSnap.empty) {
      for (const review of INITIAL_REVIEWS) {
        await setDoc(doc(db, REVIEWS_COL, review.reviewId), review);
      }
    }
  } catch (err) {
    console.warn('Firebase initial seed notice:', err);
  }
}

// -------------------------------------------------------------
// USER METHODS
// -------------------------------------------------------------

export async function getUsers(): Promise<User[]> {
  try {
    const snap = await getDocs(collection(db, USERS_COL));
    if (snap.empty) {
      await seedInitialDataIfEmpty();
      const retrySnap = await getDocs(collection(db, USERS_COL));
      return retrySnap.docs.map((docSnap) => docSnap.data() as User);
    }
    return snap.docs.map((docSnap) => docSnap.data() as User);
  } catch (error) {
    console.error('Error fetching users from Firestore:', error);
    return INITIAL_USERS;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const firebaseUser = auth.currentUser;
  const targetUid = firebaseUser ? firebaseUser.uid : currentSessionUserId;

  if (!targetUid || targetUid === 'guest') return null;

  try {
    const userDocRef = doc(db, USERS_COL, targetUid);
    const userDoc = await getDoc(userDocRef);

    let user: User | null = null;
    if (userDoc.exists()) {
      user = userDoc.data() as User;
    } else {
      const users = await getUsers();
      user = users.find((u) => u.uid === targetUid) || null;
    }

    if (user && user.strikes > 5 && !user.isBanned) {
      const banDate = new Date();
      banDate.setDate(banDate.getDate() + 180); // 6 months ban
      user.isBanned = true;
      user.banUntil = banDate.toISOString();
      await updateUser(user);
    }

    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

export async function setCurrentUserId(uid: string): Promise<void> {
  currentSessionUserId = uid;
}

export async function logoutUser(): Promise<void> {
  currentSessionUserId = 'guest';
  try {
    await signOut(auth);
  } catch (err) {
    console.error('Error during logout:', err);
  }
}

export async function loginUser(email: string, password?: string): Promise<User> {
  const normalizedEmail = email.trim().toLowerCase();
  const pwd = password || '123456';

  let authUid: string | null = null;
  try {
    const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, pwd);
    authUid = userCredential.user.uid;
  } catch (authErr: any) {
    if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential') {
      try {
        const newUserCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, pwd);
        authUid = newUserCredential.user.uid;
      } catch {
        // Fallback if email already exists in auth or auth is disabled
      }
    }
  }

  const users = await getUsers();
  let user = users.find((u) => u.email.toLowerCase() === normalizedEmail);

  if (user) {
    if (password && user.password && user.password !== password) {
      throw new Error('Mật khẩu không chính xác.');
    }
  } else {
    const username = email.split('@')[0];
    const uid = authUid || 'user_' + Date.now();
    user = {
      uid,
      email: email.trim(),
      username: username.charAt(0).toUpperCase() + username.slice(1),
      password: pwd,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`,
      strikes: 0,
      isBanned: false,
      banUntil: null,
      role: 'user',
    };
    await setDoc(doc(db, USERS_COL, user.uid), user);
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
    throw new Error('Email này đã được đăng ký. Vui lòng sử dụng tính năng Đăng nhập.');
  }

  let authUid: string | null = null;
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, pwd);
    authUid = userCredential.user.uid;
  } catch (err) {
    console.warn('Firebase Auth registration notice:', err);
  }

  const uid = authUid || 'user_' + Date.now();
  const newUser: User = {
    uid,
    email: data.email.trim(),
    username: data.username.trim(),
    password: pwd,
    avatar:
      data.avatar ||
      `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
    strikes: 0,
    isBanned: false,
    banUntil: null,
    role: 'user',
  };

  await setDoc(doc(db, USERS_COL, newUser.uid), newUser);
  currentSessionUserId = newUser.uid;
  return newUser;
}

export async function updateUser(updatedUser: User): Promise<void> {
  try {
    await setDoc(doc(db, USERS_COL, updatedUser.uid), updatedUser, { merge: true });
  } catch (error) {
    console.error('Error updating user in Firestore:', error);
  }
}

// -------------------------------------------------------------
// PLACES METHODS
// -------------------------------------------------------------

export async function getPlaces(): Promise<Place[]> {
  try {
    const placesSnap = await getDocs(collection(db, PLACES_COL));
    let places: Place[] = [];

    if (placesSnap.empty) {
      await seedInitialDataIfEmpty();
      const retrySnap = await getDocs(collection(db, PLACES_COL));
      places = retrySnap.docs.map((docSnap) => docSnap.data() as Place);
    } else {
      places = placesSnap.docs.map((docSnap) => docSnap.data() as Place);
    }

    const reviews = await getReviews();

    // Re-calculate trust score & average rating dynamically
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
  } catch (error) {
    console.error('Error fetching places from Firestore:', error);
    return INITIAL_PLACES;
  }
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

  await setDoc(doc(db, PLACES_COL, placeId), newPlace);
  return newPlace;
}

// -------------------------------------------------------------
// REVIEWS METHODS
// -------------------------------------------------------------

export async function getReviews(placeId?: string): Promise<Review[]> {
  try {
    const reviewsSnap = await getDocs(collection(db, REVIEWS_COL));
    let reviews: Review[] = [];

    if (reviewsSnap.empty) {
      await seedInitialDataIfEmpty();
      const retrySnap = await getDocs(collection(db, REVIEWS_COL));
      reviews = retrySnap.docs.map((docSnap) => docSnap.data() as Review);
    } else {
      reviews = reviewsSnap.docs.map((docSnap) => docSnap.data() as Review);
    }

    // Sort descending by creation date
    reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (placeId) {
      return reviews.filter((r) => r.placeId === placeId);
    }
    return reviews;
  } catch (error) {
    console.error('Error fetching reviews from Firestore:', error);
    return INITIAL_REVIEWS;
  }
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

  // 2. Create review object & save to Firestore
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

  await setDoc(doc(db, REVIEWS_COL, reviewId), newReview);

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

// Reset store to demo defaults in Firestore
export async function resetDemoData(): Promise<void> {
  try {
    for (const user of INITIAL_USERS) {
      await setDoc(doc(db, USERS_COL, user.uid), user);
    }
    for (const place of INITIAL_PLACES) {
      await setDoc(doc(db, PLACES_COL, place.placeId), place);
    }
    for (const review of INITIAL_REVIEWS) {
      await setDoc(doc(db, REVIEWS_COL, review.reviewId), review);
    }
    currentSessionUserId = 'guest';
    await signOut(auth);
  } catch (err) {
    console.error('Error resetting demo data:', err);
  }
}
