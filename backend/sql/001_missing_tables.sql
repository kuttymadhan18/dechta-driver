-- ============================================================
-- QC DRIVER APP — MISSING TABLES MIGRATION
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. driver_notifications — alerts/offers shown in home screen bell
CREATE TABLE IF NOT EXISTS public.driver_notifications (
  id          bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  driver_id   uuid REFERENCES public.driver_profiles(id) ON DELETE CASCADE,
  title       text NOT NULL,
  message     text NOT NULL,
  type        text DEFAULT 'info' CHECK (type IN ('info','offer','warning','success','order')),
  is_read     boolean DEFAULT false,
  created_at  timestamp with time zone DEFAULT now(),
  CONSTRAINT driver_notifications_pkey PRIMARY KEY (id)
);

-- 2. driver_gps_locations — live GPS pings during active trips
CREATE TABLE IF NOT EXISTS public.driver_gps_locations (
  id          bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  driver_id   uuid REFERENCES public.driver_profiles(id) ON DELETE CASCADE,
  trip_id     uuid REFERENCES public.delivery_trips(id) ON DELETE SET NULL,
  latitude    double precision NOT NULL,
  longitude   double precision NOT NULL,
  accuracy    double precision,
  speed       double precision,
  heading     double precision,
  recorded_at timestamp with time zone DEFAULT now(),
  CONSTRAINT driver_gps_locations_pkey PRIMARY KEY (id)
);

-- 3. driver_chat_messages — in-trip chat between driver and customer
CREATE TABLE IF NOT EXISTS public.driver_chat_messages (
  id          bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  trip_id     uuid REFERENCES public.delivery_trips(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('driver','customer','system')),
  sender_id   uuid,
  message     text NOT NULL,
  is_read     boolean DEFAULT false,
  created_at  timestamp with time zone DEFAULT now(),
  CONSTRAINT driver_chat_messages_pkey PRIMARY KEY (id)
);

-- 4. driver_promo_slides — home screen promo slider (extends driver_ads)
-- driver_ads already exists; just add display_order if missing
ALTER TABLE public.driver_ads
  ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_driver_type text DEFAULT 'all' CHECK (target_driver_type IN ('all','prime','normal'));

-- 5. driver_referrals — track who referred whom for commission logic
CREATE TABLE IF NOT EXISTS public.driver_referrals (
  id              bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  referrer_id     uuid REFERENCES public.driver_profiles(id) ON DELETE CASCADE,
  referred_id     uuid REFERENCES public.driver_profiles(id) ON DELETE CASCADE,
  bonus_paid      boolean DEFAULT false,
  bonus_amount    numeric DEFAULT 500,
  created_at      timestamp with time zone DEFAULT now(),
  CONSTRAINT driver_referrals_pkey PRIMARY KEY (id),
  CONSTRAINT driver_referrals_unique UNIQUE (referrer_id, referred_id)
);

-- 6. driver_package_photos — pickup acknowledgement photos per trip
CREATE TABLE IF NOT EXISTS public.driver_package_photos (
  id           bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  trip_id      uuid REFERENCES public.delivery_trips(id) ON DELETE CASCADE,
  driver_id    uuid REFERENCES public.driver_profiles(id) ON DELETE CASCADE,
  photo_url    text NOT NULL,
  step         integer DEFAULT 0 CHECK (step IN (0,1)), -- 0=pickup, 1=delivery
  uploaded_at  timestamp with time zone DEFAULT now(),
  CONSTRAINT driver_package_photos_pkey PRIMARY KEY (id)
);

-- 7. driver_leaderboard_cache — weekly snapshot for leaderboard screen
CREATE TABLE IF NOT EXISTS public.driver_leaderboard_cache (
  id               bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  driver_id        uuid REFERENCES public.driver_profiles(id) ON DELETE CASCADE,
  full_name        text,
  weekly_earnings  numeric DEFAULT 0,
  weekly_trips     integer DEFAULT 0,
  rank_position    integer,
  week_start       date NOT NULL,
  CONSTRAINT driver_leaderboard_cache_pkey PRIMARY KEY (id)
);

-- ============================================================
-- SUPABASE REALTIME — enable realtime on key tables
-- ============================================================
ALTER TABLE public.driver_profiles       REPLICA IDENTITY FULL;
ALTER TABLE public.delivery_trips        REPLICA IDENTITY FULL;
ALTER TABLE public.driver_notifications  REPLICA IDENTITY FULL;
ALTER TABLE public.driver_gps_locations  REPLICA IDENTITY FULL;
ALTER TABLE public.driver_chat_messages  REPLICA IDENTITY FULL;
ALTER TABLE public.driver_stats          REPLICA IDENTITY FULL;
ALTER TABLE public.driver_wallets        REPLICA IDENTITY FULL;
ALTER TABLE public.orders                REPLICA IDENTITY FULL;

-- ============================================================
-- SUPABASE STORAGE BUCKETS (run via Supabase dashboard or API)
-- ============================================================
-- Buckets to create manually in Supabase Storage:
--   driver-avatars       (public: true)
--   driver-documents     (public: false)  ← KYC: Aadhaar, PAN, RC, License
--   package-photos       (public: false)  ← Pickup/delivery photos
--   promo-images         (public: true)

-- ============================================================
-- RLS POLICIES — allow drivers to access their own data
-- ============================================================

-- Enable RLS
ALTER TABLE public.driver_notifications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_gps_locations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_chat_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_package_photos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_referrals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_leaderboard_cache ENABLE ROW LEVEL SECURITY;

-- driver_notifications: driver sees only their own
CREATE POLICY "driver_own_notifications" ON public.driver_notifications
  FOR ALL USING (driver_id = auth.uid());

-- driver_gps_locations: driver can insert/read their own
CREATE POLICY "driver_own_gps" ON public.driver_gps_locations
  FOR ALL USING (driver_id = auth.uid());

-- driver_chat_messages: participants of the trip
CREATE POLICY "driver_chat_trip" ON public.driver_chat_messages
  FOR ALL USING (true); -- controlled by trip_id access in app layer

-- driver_package_photos: driver can manage their own
CREATE POLICY "driver_own_photos" ON public.driver_package_photos
  FOR ALL USING (driver_id = auth.uid());

-- leaderboard: all drivers can read
CREATE POLICY "leaderboard_read_all" ON public.driver_leaderboard_cache
  FOR SELECT USING (true);
