-- Drive Mitra — Supabase Database Setup
-- Run this SQL in the Supabase SQL Editor to set up all tables

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
CREATE TYPE app_role AS ENUM ('owner', 'admin', 'manager', 'operator', 'viewer');
CREATE TYPE fuel_type AS ENUM ('Petrol', 'Diesel', 'CNG', 'Electric');
CREATE TYPE maintenance_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE vehicle_status AS ENUM ('healthy', 'at-risk', 'critical');
CREATE TYPE vehicle_type AS ENUM ('ICE', 'EV');

-- TN Cities (public read)
CREATE TABLE IF NOT EXISTS tn_cities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  region TEXT,
  road_stress_index NUMERIC(3,2) DEFAULT 0.5,
  climate_impact_score NUMERIC(3,2) DEFAULT 0.5,
  pothole_density TEXT DEFAULT 'moderate',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tn_cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tn_cities_public_read" ON tn_cities FOR SELECT USING (true);

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  company_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  preferred_language TEXT DEFAULT 'en',
  role_label TEXT DEFAULT 'Fleet Manager',
  is_demo_account BOOLEAN DEFAULT FALSE,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  subscription_plan TEXT DEFAULT 'free',
  subscription_status TEXT DEFAULT 'active',
  trial_expires_at TIMESTAMPTZ,
  billing_email TEXT,
  billing_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_own" ON profiles FOR ALL USING (auth.uid() = user_id);

-- User Roles
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'manager',
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_own" ON user_roles FOR SELECT USING (auth.uid() = user_id);

-- Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  registration_number TEXT NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  vehicle_type vehicle_type NOT NULL DEFAULT 'ICE',
  fuel_type fuel_type NOT NULL DEFAULT 'Diesel',
  status vehicle_status NOT NULL DEFAULT 'healthy',
  health_score INTEGER NOT NULL DEFAULT 85 CHECK (health_score >= 0 AND health_score <= 100),
  current_mileage INTEGER DEFAULT 0,
  assigned_driver TEXT,
  city_id UUID REFERENCES tn_cities(id),
  last_service_date DATE,
  next_service_due DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicles_own" ON vehicles FOR ALL USING (auth.uid() = user_id);

-- AI Predictions
CREATE TABLE IF NOT EXISTS ai_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  prediction_type TEXT,
  component_name TEXT NOT NULL,
  priority maintenance_priority DEFAULT 'medium',
  confidence_score NUMERIC(4,3) DEFAULT 0.85,
  confidence_lower NUMERIC(4,3),
  confidence_upper NUMERIC(4,3),
  predicted_failure_date DATE,
  failure_date_earliest DATE,
  failure_date_latest DATE,
  failure_probability_7d NUMERIC(4,3) DEFAULT 0,
  failure_probability_30d NUMERIC(4,3) DEFAULT 0,
  failure_probability_90d NUMERIC(4,3) DEFAULT 0,
  estimated_cost_if_fixed NUMERIC(10,2),
  estimated_cost_if_delayed NUMERIC(10,2),
  cost_of_delay_per_day NUMERIC(10,2),
  roi_if_fixed_now NUMERIC(10,2),
  ai_reasoning TEXT,
  causal_factors JSONB DEFAULT '[]',
  data_quality_score NUMERIC(3,2) DEFAULT 0.8,
  model_version TEXT DEFAULT 'v1.2.0',
  recommendation TEXT,
  is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_predictions_own" ON ai_predictions FOR ALL USING (
  EXISTS (SELECT 1 FROM vehicles WHERE vehicles.id = ai_predictions.vehicle_id AND vehicles.user_id = auth.uid())
);

-- Vehicle Components
CREATE TABLE IF NOT EXISTS vehicle_components (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  component_name TEXT NOT NULL,
  health_score INTEGER DEFAULT 85,
  status vehicle_status DEFAULT 'healthy',
  wear_rate NUMERIC(5,3),
  last_replaced DATE,
  predicted_replacement DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE vehicle_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_components_own" ON vehicle_components FOR ALL USING (
  EXISTS (SELECT 1 FROM vehicles WHERE vehicles.id = vehicle_components.vehicle_id AND vehicles.user_id = auth.uid())
);

-- Maintenance History
CREATE TABLE IF NOT EXISTS maintenance_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  maintenance_type TEXT NOT NULL,
  description TEXT,
  notes TEXT,
  cost NUMERIC(10,2),
  parts_replaced TEXT[],
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  performed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE maintenance_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "maintenance_history_own" ON maintenance_history FOR ALL USING (
  EXISTS (SELECT 1 FROM vehicles WHERE vehicles.id = maintenance_history.vehicle_id AND vehicles.user_id = auth.uid())
);

-- Driver Analytics
CREATE TABLE IF NOT EXISTS driver_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  driver_name TEXT NOT NULL,
  overall_score INTEGER DEFAULT 70,
  aggressive_driving_score INTEGER DEFAULT 50,
  over_speeding_incidents INTEGER DEFAULT 0,
  harsh_braking_count INTEGER DEFAULT 0,
  fuel_efficiency_score INTEGER DEFAULT 70,
  impact_on_vehicle TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE driver_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "driver_analytics_own" ON driver_analytics FOR ALL USING (
  EXISTS (SELECT 1 FROM vehicles WHERE vehicles.id = driver_analytics.vehicle_id AND vehicles.user_id = auth.uid())
);

-- Chat History
CREATE TABLE IF NOT EXISTS chat_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_history_own" ON chat_history FOR ALL USING (auth.uid() = user_id);

-- Audit Logs (for SaaS tracking)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_own" ON audit_logs FOR SELECT USING (auth.uid() = user_id);

-- Seed TN Cities
INSERT INTO tn_cities (name, region, road_stress_index, climate_impact_score, pothole_density) VALUES
  ('Chennai', 'North', 0.68, 0.74, 'moderate'),
  ('Coimbatore', 'West', 0.55, 0.71, 'moderate'),
  ('Madurai', 'South', 0.72, 0.82, 'high'),
  ('Trichy', 'Central', 0.61, 0.78, 'moderate'),
  ('Salem', 'North West', 0.67, 0.80, 'high'),
  ('Tiruppur', 'West', 0.48, 0.69, 'low'),
  ('Vellore', 'North East', 0.63, 0.73, 'moderate'),
  ('Erode', 'West Central', 0.59, 0.75, 'moderate'),
  ('Thoothukudi', 'South', 0.71, 0.77, 'high'),
  ('Tirunelveli', 'South', 0.66, 0.76, 'moderate'),
  ('Kanchipuram', 'North', 0.60, 0.72, 'moderate'),
  ('Thanjavur', 'Delta', 0.53, 0.79, 'low')
ON CONFLICT DO NOTHING;
