-- ==========================================
-- TravelWeb-VeriTrip Database Schema for Supabase PostgreSQL
-- ==========================================

-- 1. Create Bảng users (Liên kết với Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  avatar TEXT,
  strikes INT DEFAULT 0,
  is_banned BOOLEAN DEFAULT FALSE,
  ban_until TIMESTAMPTZ,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Bảng places
CREATE TABLE IF NOT EXISTS public.places (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  address TEXT NOT NULL,
  image TEXT,
  location JSONB, -- { "lat": 10.776, "lng": 106.700 }
  average_rating NUMERIC(3, 1) DEFAULT 5.0,
  review_count INT DEFAULT 0,
  trust_score INT DEFAULT 100,
  added_by TEXT,
  google_maps_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Bảng reviews (Lưu đánh giá & AI Anti-Seeding)
CREATE TABLE IF NOT EXISTS public.reviews (
  id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  user_name TEXT,
  user_avatar TEXT,
  rating NUMERIC(2, 1) NOT NULL,
  content TEXT NOT NULL,
  is_seeding BOOLEAN DEFAULT FALSE,
  seeding_reason TEXT,
  confidence_score NUMERIC(5, 2),
  detected_keywords TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies cho Bảng users
CREATE POLICY "Cho phép đọc thông tin người dùng công khai" ON public.users FOR SELECT USING (true);
CREATE POLICY "Cho phép người dùng tự cập nhật thông tin cá nhân" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Cho phép tạo hồ sơ người dùng" ON public.users FOR INSERT WITH CHECK (true);

-- RLS Policies cho Bảng places
CREATE POLICY "Cho phép xem danh sách địa điểm công khai" ON public.places FOR SELECT USING (true);
CREATE POLICY "Cho phép tạo địa điểm mới" ON public.places FOR INSERT WITH CHECK (true);
CREATE POLICY "Cho phép cập nhật địa điểm" ON public.places FOR UPDATE USING (true);

-- RLS Policies cho Bảng reviews
CREATE POLICY "Cho phép đọc đánh giá công khai" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Cho phép gửi đánh giá" ON public.reviews FOR INSERT WITH CHECK (true);

-- Trigger tự động tạo profile user khi có user mới đăng ký Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, username, avatar)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar', 'https://api.dicebear.com/7.x/bottts/svg?seed=' || NEW.id)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
