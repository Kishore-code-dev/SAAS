-- DriveMitra Enterprise Seed Data (Reference SQL for Supabase Deployments)
-- Note: Replace :org_uuid and :admin_user_uuid with your authenticated tenant IDs when running manually in Supabase SQL Editor.

INSERT INTO tn_cities (name, region, road_stress_index, climate_impact_score, pothole_density, avg_ambient_temp_c) VALUES
  ('Chennai', 'North Corridor', 0.66, 0.76, 'moderate', 37),
  ('Coimbatore', 'Western Industrial', 0.54, 0.68, 'moderate', 33),
  ('Madurai', 'Southern Highway', 0.74, 0.84, 'high', 40),
  ('Salem', 'NH44 Freight Belt', 0.69, 0.81, 'high', 38),
  ('Trichy', 'Central Delta', 0.60, 0.77, 'moderate', 37),
  ('Bengaluru', 'Electronic City Ring', 0.62, 0.61, 'moderate', 29),
  ('Vellore', 'NH48 Corridor', 0.63, 0.75, 'moderate', 37),
  ('Erode', 'Textile Freight Axis', 0.58, 0.74, 'moderate', 36)
ON CONFLICT DO NOTHING;

-- Sample Organization & Subscription Baseline
INSERT INTO organizations (id, name, code, city, state, timezone, currency, environment, subscription_plan, vehicle_limit, driver_limit)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Kaveri Logistics Pvt Ltd', 'KAV-TN', 'Chennai', 'Tamil Nadu', 'Asia/Kolkata', 'INR', 'demo', 'growth', 75, 120),
  ('a0000000-0000-0000-0000-000000000002', 'Deccan EV Express', 'DEC-KA', 'Bengaluru', 'Karnataka', 'Asia/Kolkata', 'INR', 'demo', 'starter', 15, 25)
ON CONFLICT (code) DO NOTHING;

INSERT INTO subscriptions (organization_id, plan_id, status, monthly_inr, vehicle_limit, driver_limit)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'growth', 'active', 14999, 75, 120),
  ('a0000000-0000-0000-0000-000000000002', 'starter', 'active', 4999, 15, 25)
ON CONFLICT DO NOTHING;
