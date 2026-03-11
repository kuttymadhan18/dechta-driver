-- ============================================================
-- DECHTA DRIVER APP — PostgreSQL Schema
-- Run this in pgAdmin on your existing 'dechta' database
-- This ADDS driver tables alongside existing vendor tables
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- OTP VERIFICATION
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_verification (
  id             BIGSERIAL PRIMARY KEY,
  mobile_number  TEXT NOT NULL,
  phone          TEXT,
  otp            TEXT NOT NULL,
  is_verified    BOOLEAN DEFAULT false,
  attempts       INTEGER DEFAULT 0,
  expires_at     TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT otp_verification_mobile_unique UNIQUE (mobile_number)
);

-- ──────────────────────────────────────────────────────────────
-- DRIVER PROFILES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_profiles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id         TEXT UNIQUE,           -- human-readable ID like DRV001
  mobile_number     TEXT NOT NULL UNIQUE,
  full_name         TEXT DEFAULT '',
  avatar_url        TEXT,
  dob               DATE,
  blood_group       TEXT,
  tshirt_size       TEXT,
  preferred_zone    TEXT,
  emergency_contact TEXT,
  referral_code     TEXT UNIQUE,
  is_approved       BOOLEAN DEFAULT false,
  is_online         BOOLEAN DEFAULT false,
  status            TEXT DEFAULT 'offline' CHECK (status IN ('online','offline','on_trip','suspended')),
  current_lat       DOUBLE PRECISION,
  current_lng       DOUBLE PRECISION,
  heading           DOUBLE PRECISION,
  last_active       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- DRIVER STATS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_stats (
  id                       BIGSERIAL PRIMARY KEY,
  driver_id                UUID REFERENCES driver_profiles(id) ON DELETE CASCADE,
  total_earnings           NUMERIC DEFAULT 0,
  weekly_earnings          NUMERIC DEFAULT 0,
  total_orders_completed   INTEGER DEFAULT 0,
  weekly_orders_completed  INTEGER DEFAULT 0,
  wallet_balance           NUMERIC DEFAULT 0,
  rating                   NUMERIC DEFAULT 5.0,
  CONSTRAINT driver_stats_driver_unique UNIQUE (driver_id)
);

-- ──────────────────────────────────────────────────────────────
-- DRIVER VEHICLES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_vehicles (
  id                  BIGSERIAL PRIMARY KEY,
  driver_id           UUID REFERENCES driver_profiles(id) ON DELETE CASCADE,
  vehicle_type        TEXT NOT NULL,      -- 2wheeler, 3wheeler, 4wheeler
  model_id            TEXT,
  model_name          TEXT,
  weight_capacity     TEXT,
  dimensions          TEXT,
  body_type           TEXT,
  registration_number TEXT NOT NULL,
  is_active           BOOLEAN DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT driver_vehicles_driver_unique UNIQUE (driver_id)
);

-- ──────────────────────────────────────────────────────────────
-- DRIVER BANK ACCOUNTS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_bank_accounts (
  id                   BIGSERIAL PRIMARY KEY,
  driver_id            UUID REFERENCES driver_profiles(id) ON DELETE CASCADE,
  account_holder_name  TEXT NOT NULL,
  account_number       TEXT NOT NULL,
  ifsc_code            TEXT NOT NULL,
  is_verified          BOOLEAN DEFAULT false,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT driver_bank_driver_unique UNIQUE (driver_id)
);

-- ──────────────────────────────────────────────────────────────
-- DRIVER DOCUMENTS (double-s kept to match existing code)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_documentss (
  id                   BIGSERIAL PRIMARY KEY,
  driver_id            UUID REFERENCES driver_profiles(id) ON DELETE CASCADE,
  aadhar_url           TEXT,
  pan_url              TEXT,
  license_url          TEXT,
  rc_url               TEXT,
  verification_status  TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending','approved','rejected')),
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT driver_docs_driver_unique UNIQUE (driver_id)
);

-- ──────────────────────────────────────────────────────────────
-- DRIVER WALLETS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_wallets (
  id               BIGSERIAL PRIMARY KEY,
  driver_id        UUID REFERENCES driver_profiles(id) ON DELETE CASCADE,
  balance          NUMERIC DEFAULT 0,
  outstanding_dues NUMERIC DEFAULT 0,
  last_updated     TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT driver_wallets_driver_unique UNIQUE (driver_id)
);

-- ──────────────────────────────────────────────────────────────
-- DRIVER TRANSACTIONS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_transactions (
  id          BIGSERIAL PRIMARY KEY,
  wallet_id   BIGINT REFERENCES driver_wallets(id) ON DELETE CASCADE,
  amount      NUMERIC NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('credit','debit')),
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- DRIVER REFERRALS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_referrals (
  id            BIGSERIAL PRIMARY KEY,
  referrer_id   UUID REFERENCES driver_profiles(id) ON DELETE CASCADE,
  referred_id   UUID REFERENCES driver_profiles(id) ON DELETE CASCADE,
  bonus_paid    BOOLEAN DEFAULT false,
  bonus_amount  NUMERIC DEFAULT 500,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT driver_referrals_unique UNIQUE (referrer_id, referred_id)
);

-- ──────────────────────────────────────────────────────────────
-- ORDERS (shared table — vendor creates, driver accepts)
-- If this already exists in your vendor schema, skip creation
-- and only add missing columns using ALTER TABLE below
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                        BIGSERIAL PRIMARY KEY,
  vendor_id                 UUID,
  driver_id                 UUID REFERENCES driver_profiles(id) ON DELETE SET NULL,
  product_name              TEXT,
  quantity                  INTEGER DEFAULT 1,
  total_amount              NUMERIC DEFAULT 0,
  delivery_fee              NUMERIC DEFAULT 0,
  customer_name             TEXT,
  customer_phone            TEXT,
  order_date                DATE DEFAULT CURRENT_DATE,
  status                    TEXT DEFAULT 'Pending',
  order_type                TEXT,
  vehicle_type              TEXT,
  pickup_address            TEXT,
  pickup_latitude           DOUBLE PRECISION,
  pickup_longitude          DOUBLE PRECISION,
  delivery_address          TEXT,
  delivery_latitude         DOUBLE PRECISION,
  delivery_longitude        DOUBLE PRECISION,
  vendor_shop_name          TEXT,
  driver_name               TEXT,
  driver_number             BIGINT,
  delivery_otp              TEXT,
  items                     JSONB,
  model_id_requested        TEXT,
  model_name_requested      TEXT,
  weight_capacity_requested TEXT,
  body_type_requested       TEXT,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

-- Add driver columns to existing orders table if they don't exist
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES driver_profiles(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_number BIGINT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_otp TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_latitude DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_longitude DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_latitude DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_longitude DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS vehicle_type TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS model_id_requested TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS model_name_requested TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS weight_capacity_requested TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS body_type_requested TEXT;

-- ──────────────────────────────────────────────────────────────
-- DELIVERY TRIPS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_trips (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       BIGINT REFERENCES orders(id) ON DELETE CASCADE,
  driver_id      UUID REFERENCES driver_profiles(id) ON DELETE CASCADE,
  status         TEXT DEFAULT 'accepted' CHECK (status IN ('accepted','picked_up','delivered','cancelled')),
  pickup_otp     TEXT,
  payout_amount  NUMERIC DEFAULT 0,
  distance_text  TEXT,
  started_at     TIMESTAMPTZ DEFAULT NOW(),
  completed_at   TIMESTAMPTZ
);

-- ──────────────────────────────────────────────────────────────
-- DRIVER NOTIFICATIONS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_notifications (
  id         BIGSERIAL PRIMARY KEY,
  driver_id  UUID REFERENCES driver_profiles(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  type       TEXT DEFAULT 'info' CHECK (type IN ('info','offer','warning','success','order')),
  is_read    BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- DRIVER GPS LOCATIONS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_gps_locations (
  id          BIGSERIAL PRIMARY KEY,
  driver_id   UUID REFERENCES driver_profiles(id) ON DELETE CASCADE,
  trip_id     UUID REFERENCES delivery_trips(id) ON DELETE SET NULL,
  latitude    DOUBLE PRECISION NOT NULL,
  longitude   DOUBLE PRECISION NOT NULL,
  accuracy    DOUBLE PRECISION,
  speed       DOUBLE PRECISION,
  heading     DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- DRIVER CHAT MESSAGES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_chat_messages (
  id          BIGSERIAL PRIMARY KEY,
  trip_id     UUID REFERENCES delivery_trips(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('driver','customer','system')),
  sender_id   UUID,
  message     TEXT NOT NULL,
  is_read     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- DRIVER PACKAGE PHOTOS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_package_photos (
  id          BIGSERIAL PRIMARY KEY,
  trip_id     UUID REFERENCES delivery_trips(id) ON DELETE CASCADE,
  driver_id   UUID REFERENCES driver_profiles(id) ON DELETE CASCADE,
  photo_url   TEXT NOT NULL,
  step        INTEGER DEFAULT 0 CHECK (step IN (0,1)),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- DRIVER ADS / PROMO SLIDES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_ads (
  id                  BIGSERIAL PRIMARY KEY,
  title               TEXT,
  image_url           TEXT,
  redirect_url        TEXT,
  display_order       INTEGER DEFAULT 0,
  target_driver_type  TEXT DEFAULT 'all' CHECK (target_driver_type IN ('all','prime','normal')),
  is_active           BOOLEAN DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- DRIVER LEADERBOARD CACHE
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_leaderboard_cache (
  id              BIGSERIAL PRIMARY KEY,
  driver_id       UUID REFERENCES driver_profiles(id) ON DELETE CASCADE,
  full_name       TEXT,
  weekly_earnings NUMERIC DEFAULT 0,
  weekly_trips    INTEGER DEFAULT 0,
  rank_position   INTEGER,
  week_start      DATE NOT NULL
);

-- ──────────────────────────────────────────────────────────────
-- INDEXES
-- ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_status           ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_driver_id        ON orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at       ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_trips_driver   ON delivery_trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_trips_status   ON delivery_trips(status);
CREATE INDEX IF NOT EXISTS idx_driver_stats_driver     ON driver_stats(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_notif_driver     ON driver_notifications(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_gps_driver       ON driver_gps_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_otp_mobile              ON otp_verification(mobile_number);

-- ──────────────────────────────────────────────────────────────
-- REAL-TIME: PostgreSQL NOTIFY trigger on orders
-- When vendor app creates a new order → NOTIFY all driver backends
-- Realtime events function
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_new_order()
RETURNS trigger AS $$
BEGIN
  -- Broadcast full order row as JSON to driver backend
  PERFORM pg_notify(
    'new_order',
    json_build_object(
      'id',                    NEW.id,
      'product_name',          NEW.product_name,
      'vendor_shop_name',      NEW.vendor_shop_name,
      'pickup_address',        NEW.pickup_address,
      'pickup_latitude',       NEW.pickup_latitude,
      'pickup_longitude',      NEW.pickup_longitude,
      'delivery_address',      NEW.delivery_address,
      'delivery_latitude',     NEW.delivery_latitude,
      'delivery_longitude',    NEW.delivery_longitude,
      'delivery_fee',          NEW.delivery_fee,
      'total_amount',          NEW.total_amount,
      'vehicle_type',          NEW.vehicle_type,
      'body_type_requested',   NEW.body_type_requested,
      'status',                NEW.status,
      'created_at',            NEW.created_at
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_new_order ON orders;
CREATE TRIGGER trg_notify_new_order
  AFTER INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'Pending')
  EXECUTE FUNCTION notify_new_order();

-- ──────────────────────────────────────────────────────────────
-- WEEKLY STATS RESET (run via pg_cron or manual cron job)
-- Resets weekly_earnings and weekly_orders_completed every Monday
-- ──────────────────────────────────────────────────────────────
-- To schedule automatically with pg_cron (if enabled on Render):
--   SELECT cron.schedule('0 0 * * 1', $$UPDATE driver_stats SET weekly_earnings=0, weekly_orders_completed=0$$);
--
-- Or add to your server startup to reset manually:
--   UPDATE driver_stats SET weekly_earnings=0, weekly_orders_completed=0
--   WHERE EXTRACT(DOW FROM NOW()) = 1;  -- Monday

-- ──────────────────────────────────────────────────────────────
-- SAMPLE TEST DATA (remove in production)
-- ──────────────────────────────────────────────────────────────
-- INSERT INTO driver_ads (title, image_url, display_order, is_active)
-- VALUES
--   ('Earn ₹500 Extra This Week!',  'https://images.unsplash.com/photo-1611590027211-b954fd027b51?q=80&w=1000', 1, true),
--   ('Prime Partner Benefits',      'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?q=80&w=1000', 2, true);
