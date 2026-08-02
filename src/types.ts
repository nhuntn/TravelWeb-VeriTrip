export interface User {
  uid: string;
  email: string;
  username: string;
  avatar?: string;
  strikes: number;
  isBanned: boolean;
  banUntil?: string | null; // ISO string date
  role?: 'guest' | 'user' | 'admin';
}

export interface LocationCoordinates {
  lat: number;
  lng: number;
}

export interface Place {
  placeId: string;
  name: string;
  category: string;
  location: LocationCoordinates;
  address: string;
  averageRating: number;
  reviewCount: number;
  addedBy: string;
  imageUrl: string;
  description: string;
  phone?: string;
  createdAt: string;
  googleMapsUrl?: string;
  trustScore?: number; // 0 - 100 calculated from genuine reviews vs seeding reviews
}

export interface Review {
  reviewId: string;
  placeId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  content: string;
  createdAt: string;
  isSeeding: boolean;
  seedingReason?: string;
  confidenceScore?: number;
  detectedKeywords?: string[];
}

export interface AISummary {
  pros: string[];
  cons: string[];
  trustScore: number;
  overallVerdict: string;
  seedingStats: {
    totalReviews: number;
    flaggedSeeding: number;
    cleanReviews: number;
  };
}

export interface AIAnalysisResult {
  isSeeding: boolean;
  seedingReason: string;
  confidenceScore: number;
  detectedKeywords: string[];
  recommendedAction: 'APPROVED' | 'FLAGGED_WARNING' | 'STRIKE_PENALTY';
}
