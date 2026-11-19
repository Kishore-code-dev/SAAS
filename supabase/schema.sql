-- DriveMitra Enterprise Fleet Intelligence Platform — PostgreSQL Schema
-- Complete multi-tenant, organization-isolated production schema with Row Level Security (RLS)
-- Note: Zero 'pilot' environment and zero 'driver' app login role; Drivers are owner-managed ERP records only.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('platform_admin', 'org_admin', 'fleet_manager', 'maintenance', 'finance', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE operating_env AS ENUM ('production');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE org_status AS ENUM ('active', 'payment_pending', 'grace_period', 'suspended', 'terminated', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fuel_type AS ENUM ('Petrol', 'Diesel', 'CNG', 'Electric');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE maintenance_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE vehicle_status AS ENUM ('healthy', 'at-risk', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE vehicle_type AS ENUM ('ICE', 'EV');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Organizations (Tenant Boundary + Level-2 Governance)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  city TEXT,
  state TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  currency TEXT NOT NULL DEFAULT 'INR',
  environment operating_env NOT NULL DEFAULT 'production',
  status org_status NOT NULL DEFAULT 'active',
  payment_status TEXT NOT NULL DEFAULT 'paid',
  subscription_plan TEXT NOT NULL DEFAULT 'starter',
  subscription_start_date TIMESTAMPTZ DEFAULT NOW(),
  subscription_expiry_date TIMESTAMPTZ DEFAULT NOW() + INTERVAL '365 days',
  grace_period_until TIMESTAMPTZ,
  suspension_reason TEXT,
  owner_name TEXT,
  owner_email TEXT,
  owner_phone TEXT,
  gstin TEXT,
  vehicle_limit INTEGER NOT NULL DEFAULT 15,
  driver_limit INTEGER NOT NULL DEFAULT 25,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization Memberships (RBAC)
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  role app_role NOT NULL DEFAULT 'fleet_manager',
  status TEXT NOT NULL DEFAULT 'active',
  password_change_required BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);

-- Helper functions for RLS organization membership & active-org status checks
CREATE OR REPLACE FUNCTION is_org_member(org_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members m
    JOIN organizations o ON o.id = m.organization_id
    WHERE m.organization_id = org_uuid
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND o.status IN ('active', 'payment_pending', 'grace_period')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION has_org_role(org_uuid UUID, allowed_roles app_role[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members m
    JOIN organizations o ON o.id = m.organization_id
    WHERE m.organization_id = org_uuid
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND o.status IN ('active', 'payment_pending', 'grace_period')
      AND m.role = ANY(allowed_roles)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "organizations_member_read" ON organizations
  FOR SELECT USING (is_org_member(id));
CREATE POLICY "organizations_auth_insert" ON organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "organizations_admin_update" ON organizations
  FOR UPDATE USING (has_org_role(id, ARRAY['platform_admin','org_admin']::app_role[]))
  WITH CHECK (has_org_role(id, ARRAY['platform_admin','org_admin']::app_role[]));
CREATE POLICY "organizations_admin_delete" ON organizations
  FOR DELETE USING (has_org_role(id, ARRAY['platform_admin','org_admin']::app_role[]));

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_members_read" ON organization_members
  FOR SELECT USING (is_org_member(organization_id) OR user_id = auth.uid());
CREATE POLICY "org_members_admin_insert" ON organization_members
  FOR INSERT WITH CHECK (
    has_org_role(organization_id, ARRAY['platform_admin','org_admin']::app_role[])
    OR (
      user_id = auth.uid()
      AND role = 'org_admin'::app_role
      AND NOT EXISTS (
        SELECT 1 FROM organization_members existing
        WHERE existing.organization_id = organization_members.organization_id
      )
    )
  );
CREATE POLICY "org_members_admin_update" ON organization_members
  FOR UPDATE USING (has_org_role(organization_id, ARRAY['platform_admin','org_admin']::app_role[]))
  WITH CHECK (has_org_role(organization_id, ARRAY['platform_admin','org_admin']::app_role[]));
CREATE POLICY "org_members_admin_delete" ON organization_members
  FOR DELETE USING (has_org_role(organization_id, ARRAY['platform_admin','org_admin']::app_role[]));

-- TN Cities & Corridors (public reference read)
CREATE TABLE IF NOT EXISTS tn_cities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  region TEXT,
  road_stress_index NUMERIC(3,2) DEFAULT 0.50,
  climate_impact_score NUMERIC(3,2) DEFAULT 0.50,
  pothole_density TEXT DEFAULT 'moderate',
  avg_ambient_temp_c INTEGER DEFAULT 34,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tn_cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tn_cities_public_read" ON tn_cities FOR SELECT USING (true);

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  default_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  username TEXT UNIQUE,
  full_name TEXT,
  company_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  preferred_language TEXT DEFAULT 'en',
  role_label TEXT DEFAULT 'Fleet Manager',
  password_change_required BOOLEAN DEFAULT TRUE,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  subscription_plan TEXT DEFAULT 'starter',
  subscription_status TEXT DEFAULT 'active',
  billing_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_own" ON profiles FOR ALL USING (auth.uid() = user_id);

-- Auth Sessions (Server-hashed SHA-256 tokens for immediate suspension revocation)
CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;

-- Password Reset Tokens (Single-use expiring recovery tokens)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL DEFAULT 'starter',
  status TEXT NOT NULL DEFAULT 'active',
  monthly_inr INTEGER NOT NULL DEFAULT 4999,
  vehicle_limit INTEGER NOT NULL DEFAULT 15,
  driver_limit INTEGER NOT NULL DEFAULT 25,
  current_period_start TIMESTAMPTZ DEFAULT NOW(),
  current_period_end TIMESTAMPTZ DEFAULT NOW() + INTERVAL '365 days',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscriptions_member_read" ON subscriptions
  FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "subscriptions_admin_write" ON subscriptions
  FOR ALL USING (has_org_role(organization_id, ARRAY['platform_admin','org_admin','finance']::app_role[]))
  WITH CHECK (has_org_role(organization_id, ARRAY['platform_admin','org_admin','finance']::app_role[]));

-- Vehicles & Commercial Technical Specifications
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  environment operating_env NOT NULL DEFAULT 'production',
  registration_number TEXT NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  category TEXT DEFAULT 'Light Commercial',
  year INTEGER NOT NULL,
  vehicle_type vehicle_type NOT NULL DEFAULT 'ICE',
  fuel_type fuel_type NOT NULL DEFAULT 'Diesel',
  status vehicle_status NOT NULL DEFAULT 'healthy',
  operation_status TEXT DEFAULT 'stopped',
  health_score INTEGER NOT NULL DEFAULT 85 CHECK (health_score >= 0 AND health_score <= 100),
  current_mileage INTEGER DEFAULT 0,
  daily_avg_km INTEGER DEFAULT 140,
  assigned_driver TEXT,
  city_id UUID REFERENCES tn_cities(id),
  insurance_provider TEXT,
  insurance_expiry DATE,
  registration_expiry DATE,
  fitness_expiry DATE,
  puc_expiry DATE,
  permit_expiry DATE,
  last_service_date DATE,
  next_service_due DATE,
  next_service_due_km INTEGER,
  height_m NUMERIC(4,2) DEFAULT 3.2,
  width_m NUMERIC(4,2) DEFAULT 2.3,
  length_m NUMERIC(5,2) DEFAULT 7.2,
  gvw_kg INTEGER DEFAULT 16200,
  axle_count INTEGER DEFAULT 2,
  payload_capacity_kg INTEGER DEFAULT 9500,
  hazmat_class TEXT,
  decommissioned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_org ON vehicles(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_active_reg_unique
  ON vehicles (organization_id, UPPER(TRIM(registration_number)))
  WHERE decommissioned = FALSE;

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicles_org_read" ON vehicles FOR SELECT USING (
  (organization_id IS NOT NULL AND is_org_member(organization_id))
  OR (organization_id IS NULL AND auth.uid() = user_id)
);
CREATE POLICY "vehicles_manager_insert" ON vehicles FOR INSERT WITH CHECK (
  (organization_id IS NOT NULL AND has_org_role(organization_id, ARRAY['platform_admin','org_admin','fleet_manager']::app_role[]))
  OR (organization_id IS NULL AND auth.uid() = user_id)
);
CREATE POLICY "vehicles_manager_update" ON vehicles FOR UPDATE USING (
  (organization_id IS NOT NULL AND has_org_role(organization_id, ARRAY['platform_admin','org_admin','fleet_manager','maintenance']::app_role[]))
  OR (organization_id IS NULL AND auth.uid() = user_id)
) WITH CHECK (
  (organization_id IS NOT NULL AND has_org_role(organization_id, ARRAY['platform_admin','org_admin','fleet_manager','maintenance']::app_role[]))
  OR (organization_id IS NULL AND auth.uid() = user_id)
);
CREATE POLICY "vehicles_admin_delete" ON vehicles FOR DELETE USING (
  (organization_id IS NOT NULL AND has_org_role(organization_id, ARRAY['platform_admin','org_admin']::app_role[]))
  OR (organization_id IS NULL AND auth.uid() = user_id)
);

-- Owner-Managed Drivers Master (India Commercial Fleet Compliance — NO Driver Auth)
CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_code TEXT,
  full_name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  alternate_mobile TEXT,
  email TEXT,
  date_of_birth DATE,
  city TEXT,
  state TEXT,
  address TEXT,
  blood_group TEXT,
  emergency_contact_name TEXT,
  emergency_contact_relation TEXT,
  emergency_contact_phone TEXT,
  license_number TEXT NOT NULL,
  license_categories TEXT[] DEFAULT ARRAY['TRANS'],
  license_issuing_rto TEXT,
  license_issue_date DATE,
  license_expiry DATE NOT NULL,
  hazmat_endorsed BOOLEAN DEFAULT FALSE,
  hazmat_expiry DATE,
  aadhaar_masked TEXT,
  pan_masked TEXT,
  medical_fitness_expiry DATE,
  police_verification_status TEXT DEFAULT 'not_submitted',
  digilocker_status TEXT DEFAULT 'not_connected',
  assigned_vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  operational_status TEXT NOT NULL DEFAULT 'active',
  safety_score INTEGER DEFAULT 85,
  total_trips INTEGER DEFAULT 0,
  total_distance_km INTEGER DEFAULT 0,
  join_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drivers_org ON drivers(organization_id);
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drivers_org_read" ON drivers FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "drivers_manager_write" ON drivers FOR ALL USING (
  has_org_role(organization_id, ARRAY['platform_admin','org_admin','fleet_manager']::app_role[])
) WITH CHECK (
  has_org_role(organization_id, ARRAY['platform_admin','org_admin','fleet_manager']::app_role[])
);

-- Driver Assignment History
CREATE TABLE IF NOT EXISTS driver_vehicle_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unassigned_at TIMESTAMPTZ,
  assigned_by TEXT,
  notes TEXT
);
ALTER TABLE driver_vehicle_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "driver_assignments_org_read" ON driver_vehicle_assignments FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "driver_assignments_manager_write" ON driver_vehicle_assignments FOR ALL USING (
  has_org_role(organization_id, ARRAY['platform_admin','org_admin','fleet_manager']::app_role[])
) WITH CHECK (
  has_org_role(organization_id, ARRAY['platform_admin','org_admin','fleet_manager']::app_role[])
);

-- Private Compliance Document Vault (Strict Uploaded != Verified Policy)
CREATE TABLE IF NOT EXISTS document_vault (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('vehicle', 'driver')),
  entity_id UUID NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  masked_number TEXT,
  issuing_authority TEXT,
  issued_date DATE,
  expiry_date DATE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  storage_key TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'uploaded' CHECK (verification_status IN ('uploaded', 'pending_verification', 'verified', 'rejected', 'expired')),
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  uploaded_by TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE document_vault ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doc_vault_org_read" ON document_vault FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "doc_vault_ops_write" ON document_vault FOR ALL USING (
  has_org_role(organization_id, ARRAY['platform_admin','org_admin','fleet_manager']::app_role[])
) WITH CHECK (
  has_org_role(organization_id, ARRAY['platform_admin','org_admin','fleet_manager']::app_role[])
);

-- Vehicle Components
CREATE TABLE IF NOT EXISTS vehicle_components (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
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
CREATE POLICY "vehicle_components_org_read" ON vehicle_components FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM vehicles v
    WHERE v.id = vehicle_components.vehicle_id
      AND ((v.organization_id IS NOT NULL AND is_org_member(v.organization_id))
        OR (v.organization_id IS NULL AND v.user_id = auth.uid()))
  )
);
CREATE POLICY "vehicle_components_maint_write" ON vehicle_components FOR ALL USING (
  EXISTS (
    SELECT 1 FROM vehicles v
    WHERE v.id = vehicle_components.vehicle_id
      AND ((v.organization_id IS NOT NULL AND has_org_role(v.organization_id, ARRAY['platform_admin','org_admin','fleet_manager','maintenance']::app_role[]))
        OR (v.organization_id IS NULL AND v.user_id = auth.uid()))
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM vehicles v
    WHERE v.id = vehicle_components.vehicle_id
      AND ((v.organization_id IS NOT NULL AND has_org_role(v.organization_id, ARRAY['platform_admin','org_admin','fleet_manager','maintenance']::app_role[]))
        OR (v.organization_id IS NULL AND v.user_id = auth.uid()))
  )
);

-- Trips (Owner-scheduled & Monitored Commercial Corridors)
CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  driver_name TEXT,
  origin_address TEXT NOT NULL,
  destination_address TEXT,
  start_lat NUMERIC(9,6),
  start_lng NUMERIC(9,6),
  end_lat NUMERIC(9,6),
  end_lng NUMERIC(9,6),
  distance_km NUMERIC(10,2) DEFAULT 0,
  planned_distance_km NUMERIC(10,2) DEFAULT 0,
  duration_minutes INTEGER DEFAULT 0,
  planned_duration_minutes INTEGER DEFAULT 0,
  avg_speed_kmh NUMERIC(5,1) DEFAULT 0,
  max_speed_kmh NUMERIC(5,1) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  truck_routing_mode TEXT DEFAULT 'highway_geometry_unverified',
  route_points JSONB DEFAULT '[]',
  stops JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trips_org ON trips(organization_id);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle ON trips(vehicle_id);
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trips_org_read" ON trips FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "trips_manager_insert" ON trips FOR INSERT WITH CHECK (
  has_org_role(organization_id, ARRAY['platform_admin','org_admin','fleet_manager']::app_role[])
);
CREATE POLICY "trips_manager_update" ON trips FOR UPDATE USING (
  has_org_role(organization_id, ARRAY['platform_admin','org_admin','fleet_manager']::app_role[])
) WITH CHECK (
  has_org_role(organization_id, ARRAY['platform_admin','org_admin','fleet_manager']::app_role[])
);
CREATE POLICY "trips_admin_delete" ON trips FOR DELETE USING (
  has_org_role(organization_id, ARRAY['platform_admin','org_admin']::app_role[])
);

-- Telemetry Points
CREATE TABLE IF NOT EXISTS telemetry_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  lat NUMERIC(9,6) NOT NULL,
  lng NUMERIC(9,6) NOT NULL,
  speed_kmh NUMERIC(5,1) DEFAULT 0,
  heading INTEGER DEFAULT 0,
  gps_accuracy_meters INTEGER DEFAULT 10,
  signal_quality_pct INTEGER DEFAULT 90,
  connection_state TEXT DEFAULT 'connected',
  source TEXT DEFAULT 'smartphone_gps',
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_vehicle_time ON telemetry_points(vehicle_id, recorded_at DESC);
ALTER TABLE telemetry_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "telemetry_org_read" ON telemetry_points FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "telemetry_manager_insert" ON telemetry_points FOR INSERT WITH CHECK (
  has_org_role(organization_id, ARRAY['platform_admin','org_admin','fleet_manager']::app_role[])
);
CREATE POLICY "telemetry_admin_delete" ON telemetry_points FOR DELETE USING (
  has_org_role(organization_id, ARRAY['platform_admin','org_admin']::app_role[])
);

-- Driver Behavior Events (Owner review & dispute audit)
CREATE TABLE IF NOT EXISTS driver_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  driver_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  speed_kmh NUMERIC(5,1) DEFAULT 0,
  road_stress_context NUMERIC(3,2) DEFAULT 0.50,
  gps_accuracy_meters INTEGER DEFAULT 10,
  mount_stability_warning BOOLEAN DEFAULT FALSE,
  dispute_status TEXT NOT NULL DEFAULT 'none',
  dispute_reason TEXT,
  dispute_resolution_note TEXT,
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE driver_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "driver_events_org_read" ON driver_events FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "driver_events_insert" ON driver_events FOR INSERT WITH CHECK (
  has_org_role(organization_id, ARRAY['platform_admin','org_admin','fleet_manager']::app_role[])
);
CREATE POLICY "driver_events_manager_update" ON driver_events FOR UPDATE USING (
  has_org_role(organization_id, ARRAY['platform_admin','org_admin','fleet_manager']::app_role[])
) WITH CHECK (
  has_org_role(organization_id, ARRAY['platform_admin','org_admin','fleet_manager']::app_role[])
);
CREATE POLICY "driver_events_admin_delete" ON driver_events FOR DELETE USING (
  has_org_role(organization_id, ARRAY['platform_admin','org_admin']::app_role[])
);

-- Fuel Transactions
CREATE TABLE IF NOT EXISTS fuel_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  driver_name TEXT,
  amount_inr NUMERIC(10,2) NOT NULL,
  liters_or_kwh NUMERIC(8,2) NOT NULL,
  unit_price_inr NUMERIC(8,2) NOT NULL,
  odometer_km INTEGER NOT NULL,
  station TEXT,
  payment_method TEXT DEFAULT 'upi',
  entry_source TEXT DEFAULT 'owner_entry',
  verification_status TEXT DEFAULT 'pending',
  payment_state TEXT DEFAULT 'recorded',
  anomaly_flags JSONB DEFAULT '[]',
  transacted_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE fuel_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fuel_tx_org_read" ON fuel_transactions FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "fuel_tx_member_insert" ON fuel_transactions FOR INSERT WITH CHECK (
  has_org_role(organization_id, ARRAY['platform_admin','org_admin','fleet_manager','finance']::app_role[])
);
CREATE POLICY "fuel_tx_finance_update" ON fuel_transactions FOR UPDATE USING (
  has_org_role(organization_id, ARRAY['platform_admin','org_admin','fleet_manager','finance']::app_role[])
) WITH CHECK (
  has_org_role(organization_id, ARRAY['platform_admin','org_admin','fleet_manager','finance']::app_role[])
);
CREATE POLICY "fuel_tx_admin_delete" ON fuel_transactions FOR DELETE USING (
  has_org_role(organization_id, ARRAY['platform_admin','org_admin']::app_role[])
);

-- Vehicle Inspections
CREATE TABLE IF NOT EXISTS vehicle_inspections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  driver_name TEXT NOT NULL,
  tyre_condition TEXT NOT NULL DEFAULT 'good',
  brake_feel TEXT NOT NULL DEFAULT 'normal',
  fluid_leaks_detected BOOLEAN DEFAULT FALSE,
  warning_lights_on BOOLEAN DEFAULT FALSE,
  battery_issue BOOLEAN DEFAULT FALSE,
  passed BOOLEAN DEFAULT TRUE,
  notes TEXT,
  inspected_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE vehicle_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inspections_org_read" ON vehicle_inspections FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "inspections_member_insert" ON vehicle_inspections FOR INSERT WITH CHECK (
  has_org_role(organization_id, ARRAY['platform_admin','org_admin','fleet_manager','maintenance']::app_role[])
);

-- Small-Issue Logs
CREATE TABLE IF NOT EXISTS vehicle_issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  health_area TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  source TEXT DEFAULT 'owner_manual',
  reported_by TEXT NOT NULL,
  reported_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE vehicle_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_issues_org_read" ON vehicle_issues FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "vehicle_issues_ops_write" ON vehicle_issues FOR ALL USING (
  has_org_role(organization_id, ARRAY['platform_admin','org_admin','fleet_manager','maintenance']::app_role[])
) WITH CHECK (
  has_org_role(organization_id, ARRAY['platform_admin','org_admin','fleet_manager','maintenance']::app_role[])
);

-- Work Orders, Parts Inventory, Suppliers & Purchase Orders
CREATE TABLE IF NOT EXISTS work_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  work_order_number TEXT NOT NULL,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  workshop_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  health_area TEXT NOT NULL,
  priority maintenance_priority DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'draft',
  labor_cost_inr NUMERIC(10,2) DEFAULT 0,
  parts_cost_inr NUMERIC(10,2) DEFAULT 0,
  total_cost_inr NUMERIC(10,2) DEFAULT 0,
  payment_state TEXT DEFAULT 'recorded',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "work_orders_org_read" ON work_orders FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "work_orders_maint_write" ON work_orders FOR ALL USING (
  has_org_role(organization_id, ARRAY['platform_admin','org_admin','fleet_manager','maintenance']::app_role[])
) WITH CHECK (
  has_org_role(organization_id, ARRAY['platform_admin','org_admin','fleet_manager','maintenance']::app_role[])
);

CREATE TABLE IF NOT EXISTS parts_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  stock_qty INTEGER NOT NULL DEFAULT 0,
  reorder_threshold INTEGER NOT NULL DEFAULT 2,
  unit_cost_inr NUMERIC(10,2) NOT NULL DEFAULT 0,
  warehouse_location TEXT DEFAULT 'Main Depot'
);
ALTER TABLE parts_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parts_inventory_org_read" ON parts_inventory FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "parts_inventory_maint_write" ON parts_inventory FOR ALL USING (
  has_org_role(organization_id, ARRAY['platform_admin','org_admin','fleet_manager','maintenance']::app_role[])
) WITH CHECK (
  has_org_role(organization_id, ARRAY['platform_admin','org_admin','fleet_manager','maintenance']::app_role[])
);

-- Financial Invoices & Payments (Recorded vs Verified vs Paid)
CREATE TABLE IF NOT EXISTS financial_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  category TEXT NOT NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  amount_inr NUMERIC(12,2) NOT NULL,
  paid_amount_inr NUMERIC(12,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'recorded',
  due_date DATE,
  issued_date DATE DEFAULT CURRENT_DATE
);
ALTER TABLE financial_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "financial_invoices_org_read" ON financial_invoices FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "financial_invoices_fin_write" ON financial_invoices FOR ALL USING (
  has_org_role(organization_id, ARRAY['platform_admin','org_admin','finance']::app_role[])
) WITH CHECK (
  has_org_role(organization_id, ARRAY['platform_admin','org_admin','finance']::app_role[])
);

-- AI Predictions
CREATE TABLE IF NOT EXISTS ai_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  prediction_type TEXT,
  component_name TEXT NOT NULL,
  health_area TEXT,
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
  input_features JSONB DEFAULT '{}',
  data_quality_score NUMERIC(3,2) DEFAULT 0.8,
  model_version TEXT DEFAULT 'dm-predictive-rf-baseline-v2.4.0',
  recommendation TEXT,
  status TEXT DEFAULT 'open',
  is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_predictions_org_read" ON ai_predictions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM vehicles v
    WHERE v.id = ai_predictions.vehicle_id
      AND ((v.organization_id IS NOT NULL AND is_org_member(v.organization_id))
        OR (v.organization_id IS NULL AND v.user_id = auth.uid()))
  )
);
CREATE POLICY "ai_predictions_maint_write" ON ai_predictions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM vehicles v
    WHERE v.id = ai_predictions.vehicle_id
      AND ((v.organization_id IS NOT NULL AND has_org_role(v.organization_id, ARRAY['platform_admin','org_admin','fleet_manager','maintenance']::app_role[]))
        OR (v.organization_id IS NULL AND v.user_id = auth.uid()))
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM vehicles v
    WHERE v.id = ai_predictions.vehicle_id
      AND ((v.organization_id IS NOT NULL AND has_org_role(v.organization_id, ARRAY['platform_admin','org_admin','fleet_manager','maintenance']::app_role[]))
        OR (v.organization_id IS NULL AND v.user_id = auth.uid()))
  )
);

-- Maintenance History
CREATE TABLE IF NOT EXISTS maintenance_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  maintenance_type TEXT NOT NULL,
  component_name TEXT,
  description TEXT,
  notes TEXT,
  cost NUMERIC(10,2),
  payment_state TEXT DEFAULT 'recorded',
  bill_number TEXT,
  downtime_days INTEGER DEFAULT 1,
  parts_replaced TEXT[],
  status TEXT DEFAULT 'completed',
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  performed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE maintenance_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "maintenance_history_org_read" ON maintenance_history FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM vehicles v
    WHERE v.id = maintenance_history.vehicle_id
      AND ((v.organization_id IS NOT NULL AND is_org_member(v.organization_id))
        OR (v.organization_id IS NULL AND v.user_id = auth.uid()))
  )
);
CREATE POLICY "maintenance_history_maint_write" ON maintenance_history FOR ALL USING (
  EXISTS (
    SELECT 1 FROM vehicles v
    WHERE v.id = maintenance_history.vehicle_id
      AND ((v.organization_id IS NOT NULL AND has_org_role(v.organization_id, ARRAY['platform_admin','org_admin','fleet_manager','maintenance']::app_role[]))
        OR (v.organization_id IS NULL AND v.user_id = auth.uid()))
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM vehicles v
    WHERE v.id = maintenance_history.vehicle_id
      AND ((v.organization_id IS NOT NULL AND has_org_role(v.organization_id, ARRAY['platform_admin','org_admin','fleet_manager','maintenance']::app_role[]))
        OR (v.organization_id IS NULL AND v.user_id = auth.uid()))
  )
);

-- Driver Analytics
CREATE TABLE IF NOT EXISTS driver_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
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
CREATE POLICY "driver_analytics_org_read" ON driver_analytics FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM vehicles v
    WHERE v.id = driver_analytics.vehicle_id
      AND ((v.organization_id IS NOT NULL AND is_org_member(v.organization_id))
        OR (v.organization_id IS NULL AND v.user_id = auth.uid()))
  )
);
CREATE POLICY "driver_analytics_manager_write" ON driver_analytics FOR ALL USING (
  EXISTS (
    SELECT 1 FROM vehicles v
    WHERE v.id = driver_analytics.vehicle_id
      AND ((v.organization_id IS NOT NULL AND has_org_role(v.organization_id, ARRAY['platform_admin','org_admin','fleet_manager']::app_role[]))
        OR (v.organization_id IS NULL AND v.user_id = auth.uid()))
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM vehicles v
    WHERE v.id = driver_analytics.vehicle_id
      AND ((v.organization_id IS NOT NULL AND has_org_role(v.organization_id, ARRAY['platform_admin','org_admin','fleet_manager']::app_role[]))
        OR (v.organization_id IS NULL AND v.user_id = auth.uid()))
  )
);

-- Risk Assessments (10 Categories)
CREATE TABLE IF NOT EXISTS risk_assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  evidence TEXT NOT NULL,
  confidence_pct INTEGER DEFAULT 80,
  insufficient_data BOOLEAN DEFAULT FALSE,
  recommended_action TEXT,
  assessed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE risk_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "risk_assessments_org_read" ON risk_assessments FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "risk_assessments_ops_write" ON risk_assessments FOR ALL USING (
  has_org_role(organization_id, ARRAY['platform_admin','org_admin','fleet_manager','maintenance']::app_role[])
) WITH CHECK (
  has_org_role(organization_id, ARRAY['platform_admin','org_admin','fleet_manager','maintenance']::app_role[])
);

-- Immutable Audit Logs (Organization + Level-2 Platform Admin)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_org_read" ON audit_logs FOR SELECT USING (
  (organization_id IS NOT NULL AND is_org_member(organization_id))
  OR (organization_id IS NULL AND auth.uid() = user_id)
);
CREATE POLICY "audit_logs_org_insert" ON audit_logs FOR INSERT WITH CHECK (
  (organization_id IS NOT NULL AND is_org_member(organization_id))
  OR (organization_id IS NULL AND auth.uid() = user_id)
);

-- Prevent hard deletion of vehicles that have trip or maintenance history (use soft decommissioned=true)
CREATE OR REPLACE FUNCTION prevent_vehicle_hard_delete_with_history()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM trips WHERE vehicle_id = OLD.id)
     OR EXISTS (SELECT 1 FROM maintenance_history WHERE vehicle_id = OLD.id) THEN
    RAISE EXCEPTION 'Cannot hard-delete vehicle % with historical trip or maintenance records; set decommissioned = TRUE instead.', OLD.id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_vehicle_hard_delete ON vehicles;
CREATE TRIGGER trg_prevent_vehicle_hard_delete
  BEFORE DELETE ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_vehicle_hard_delete_with_history();

-- Seed TN Cities
INSERT INTO tn_cities (name, region, road_stress_index, climate_impact_score, pothole_density, avg_ambient_temp_c) VALUES
  ('Chennai', 'North', 0.68, 0.74, 'moderate', 36),
  ('Coimbatore', 'West', 0.55, 0.71, 'moderate', 33),
  ('Madurai', 'South', 0.72, 0.82, 'high', 39),
  ('Trichy', 'Central', 0.61, 0.78, 'moderate', 37),
  ('Salem', 'North West', 0.67, 0.80, 'high', 38),
  ('Tiruppur', 'West', 0.48, 0.69, 'low', 34),
  ('Vellore', 'North East', 0.63, 0.73, 'moderate', 37),
  ('Erode', 'West Central', 0.59, 0.75, 'moderate', 36),
  ('Thoothukudi', 'South', 0.71, 0.77, 'high', 36),
  ('Tirunelveli', 'South', 0.66, 0.76, 'moderate', 37)
ON CONFLICT DO NOTHING;
