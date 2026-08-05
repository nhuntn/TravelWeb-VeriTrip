-- ====================================================================
-- VERITRIP SUPABASE HARDENED DATABASE SCHEMA & RLS SECURITY POLICIES
-- ====================================================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  avatar TEXT,
  strikes INTEGER NOT NULL DEFAULT 0,
  is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  ban_until TIMESTAMPTZ,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Select policy: Everyone can view basic user profiles
DROP POLICY IF EXISTS "Public users view policy" ON public.users;
CREATE POLICY "Public users view policy" ON public.users
  FOR SELECT USING (true);

-- Insert policy: Handled via trigger or signup
DROP POLICY IF EXISTS "Users can insert own row" ON public.users;
CREATE POLICY "Users can insert own row" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- UPDATE policy: PREVENT PRIVILEGE ESCALATION
-- Users can only update their username/avatar, NOT role, strikes, or is_banned!
DROP POLICY IF EXISTS "Users update own non-sensitive profile" ON public.users;
CREATE POLICY "Users update own non-sensitive profile" ON public.users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    role = (SELECT role FROM public.users WHERE id = auth.uid()) AND
    strikes = (SELECT strikes FROM public.users WHERE id = auth.uid()) AND
    is_banned = (SELECT is_banned FROM public.users WHERE id = auth.uid())
  );

-- Admin policy for users table
DROP POLICY IF EXISTS "Admins have full update access" ON public.users;
CREATE POLICY "Admins have full update access" ON public.users
  FOR UPDATE USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );


-- 2. PLACES TABLE
CREATE TABLE IF NOT EXISTS public.places (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Địa điểm du lịch',
  address TEXT NOT NULL,
  description TEXT,
  phone TEXT,
  image TEXT,
  location JSONB NOT NULL DEFAULT '{"lat": 15.3405, "lng": 108.9212}'::jsonb,
  average_rating NUMERIC(3, 1) NOT NULL DEFAULT 5.0,
  review_count INTEGER NOT NULL DEFAULT 0,
  trust_score INTEGER NOT NULL DEFAULT 100,
  added_by TEXT NOT NULL DEFAULT 'Thành viên cộng đồng',
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  google_maps_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on places
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;

-- Select policy: Anyone can view places
DROP POLICY IF EXISTS "Anyone can view places" ON public.places;
CREATE POLICY "Anyone can view places" ON public.places
  FOR SELECT USING (true);

-- Insert policy: Authenticated users can add places
DROP POLICY IF EXISTS "Authenticated users can add places" ON public.places;
CREATE POLICY "Authenticated users can add places" ON public.places
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Update policy: ONLY the owner or an admin can update a place
DROP POLICY IF EXISTS "Owner or admin can update place" ON public.places;
CREATE POLICY "Owner or admin can update place" ON public.places
  FOR UPDATE USING (
    owner_id = auth.uid() OR
    added_by = (SELECT email FROM public.users WHERE id = auth.uid()) OR
    added_by = (SELECT username FROM public.users WHERE id = auth.uid()) OR
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

-- Delete policy: ONLY admin or owner can delete
DROP POLICY IF EXISTS "Owner or admin can delete place" ON public.places;
CREATE POLICY "Owner or admin can delete place" ON public.places
  FOR DELETE USING (
    owner_id = auth.uid() OR
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );


-- 3. REVIEWS TABLE
CREATE TABLE IF NOT EXISTS public.reviews (
  id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  user_avatar TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content TEXT NOT NULL,
  is_seeding BOOLEAN NOT NULL DEFAULT FALSE,
  seeding_reason TEXT,
  confidence_score INTEGER DEFAULT 100,
  detected_keywords TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on reviews
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Select policy: Anyone can view reviews
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;
CREATE POLICY "Anyone can view reviews" ON public.reviews
  FOR SELECT USING (true);

-- Insert policy: Authenticated non-banned users can insert reviews
DROP POLICY IF EXISTS "Non-banned users can insert reviews" ON public.reviews;
CREATE POLICY "Non-banned users can insert reviews" ON public.reviews
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    COALESCE((SELECT is_banned FROM public.users WHERE id = auth.uid()), false) = false
  );

-- Delete policy: Authors or admins can delete reviews
DROP POLICY IF EXISTS "Author or admin can delete review" ON public.reviews;
CREATE POLICY "Author or admin can delete review" ON public.reviews
  FOR DELETE USING (
    user_id = auth.uid() OR
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );


-- 4. AUTOMATIC NEW USER PROFILE TRIGGER (SECURITY DEFINER)
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

