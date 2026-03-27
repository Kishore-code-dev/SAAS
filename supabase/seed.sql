-- ============================================================
-- DRIVE MITRA — COMPLETE SEED DATA
-- Run AFTER schema.sql in the Supabase SQL Editor
-- This creates a demo user + full fleet data for testing
-- ============================================================

-- NOTE: Replace 'YOUR_USER_ID_HERE' with a real auth.users UUID
-- after creating an account, or use the Supabase Dashboard to
-- insert rows scoped to your user ID.
-- 
-- HOW TO GET YOUR USER ID:
-- 1. Sign up at http://localhost:5173/auth
-- 2. In Supabase Dashboard → Authentication → Users → copy your UUID
-- 3. Replace every occurrence of 'YOUR_USER_ID_HERE' below

-- ============================================================
-- STEP 1: TN Cities (already seeded in schema.sql, skip if done)
-- ============================================================
INSERT INTO tn_cities (id, name, region, road_stress_index, climate_impact_score, pothole_density)
VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Chennai',      'North',      0.68, 0.74, 'moderate'),
  ('c2000000-0000-0000-0000-000000000002', 'Coimbatore',   'West',       0.55, 0.71, 'moderate'),
  ('c3000000-0000-0000-0000-000000000003', 'Madurai',      'South',      0.72, 0.82, 'high'),
  ('c4000000-0000-0000-0000-000000000004', 'Trichy',       'Central',    0.61, 0.78, 'moderate'),
  ('c5000000-0000-0000-0000-000000000005', 'Salem',        'North West', 0.67, 0.80, 'high'),
  ('c6000000-0000-0000-0000-000000000006', 'Tiruppur',     'West',       0.48, 0.69, 'low'),
  ('c7000000-0000-0000-0000-000000000007', 'Vellore',      'North East', 0.63, 0.73, 'moderate'),
  ('c8000000-0000-0000-0000-000000000008', 'Erode',        'West Central',0.59, 0.75,'moderate'),
  ('c9000000-0000-0000-0000-000000000009', 'Thoothukudi',  'South',      0.71, 0.77, 'high'),
  ('ca000000-0000-0000-0000-000000000010', 'Tirunelveli',  'South',      0.66, 0.76, 'moderate'),
  ('cb000000-0000-0000-0000-000000000011', 'Kanchipuram',  'North',      0.60, 0.72, 'moderate'),
  ('cc000000-0000-0000-0000-000000000012', 'Thanjavur',    'Delta',      0.53, 0.79, 'low')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 2: Profile (update user_id after sign-up)
-- ============================================================
INSERT INTO profiles (user_id, full_name, company_name, phone, preferred_language, role_label, onboarding_completed)
VALUES ('YOUR_USER_ID_HERE', 'Arjun Krishnamurthy', 'KrishnaFleet Logistics Pvt. Ltd.', '+91 98450 77321', 'en', 'Fleet Manager', true)
ON CONFLICT (user_id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  company_name = EXCLUDED.company_name,
  onboarding_completed = true;

-- ============================================================
-- STEP 3: Vehicles (12 vehicles)
-- ============================================================
INSERT INTO vehicles (id, user_id, registration_number, make, model, year, vehicle_type, fuel_type, status, health_score, current_mileage, assigned_driver, city_id, last_service_date, next_service_due)
VALUES
  ('v1000000-0000-0000-0000-000000000001', 'YOUR_USER_ID_HERE', 'TN09EF7890', 'Tata',          'Ace Gold',       2021, 'ICE', 'Diesel',   'healthy',  94,  48200,  'Rajesh Kumar',  'c1000000-0000-0000-0000-000000000001', '2025-12-10', '2026-06-10'),
  ('v2000000-0000-0000-0000-000000000002', 'YOUR_USER_ID_HERE', 'TN38BK2145', 'Mahindra',      'Bolero Pik-Up',  2020, 'ICE', 'Diesel',   'at-risk',  62,  87340,  'Murugan S',     'c2000000-0000-0000-0000-000000000002', '2025-09-05', '2026-03-05'),
  ('v3000000-0000-0000-0000-000000000003', 'YOUR_USER_ID_HERE', 'TN59MN4532', 'Ashok Leyland', 'Dost+',          2019, 'ICE', 'Diesel',   'critical', 38,  145600, 'Selvam P',      'c3000000-0000-0000-0000-000000000003', '2025-06-20', '2025-12-20'),
  ('v4000000-0000-0000-0000-000000000004', 'YOUR_USER_ID_HERE', 'TN22XZ9901', 'Tata',          'Nexon EV',       2023, 'EV',  'Electric', 'healthy',  91,  22100,  'Karthik R',     'c1000000-0000-0000-0000-000000000001', '2025-11-18', '2026-05-18'),
  ('v5000000-0000-0000-0000-000000000005', 'YOUR_USER_ID_HERE', 'TN07PQ3311', 'Eicher',        'Pro 2049',       2018, 'ICE', 'Diesel',   'critical', 34,  198700, 'Arun Vel',      'c5000000-0000-0000-0000-000000000005', '2025-04-10', '2025-10-10'),
  ('v6000000-0000-0000-0000-000000000006', 'YOUR_USER_ID_HERE', 'TN45YA6678', 'BharatBenz',    '1217C',          2022, 'ICE', 'Diesel',   'at-risk',  57,  72800,  'Pradeep M',     'c6000000-0000-0000-0000-000000000006', '2025-08-25', '2026-02-25'),
  ('v7000000-0000-0000-0000-000000000007', 'YOUR_USER_ID_HERE', 'TN63CD1122', 'MG',            'ZS EV',          2023, 'EV',  'Electric', 'healthy',  88,  18500,  'Suresh V',      'c2000000-0000-0000-0000-000000000002', '2025-12-01', '2026-06-01'),
  ('v8000000-0000-0000-0000-000000000008', 'YOUR_USER_ID_HERE', 'TN11WR5567', 'Swaraj Mazda',  'T810',           2017, 'ICE', 'CNG',      'at-risk',  49,  231000, 'Gopal K',       'c4000000-0000-0000-0000-000000000004', '2025-07-15', '2026-01-15'),
  ('v9000000-0000-0000-0000-000000000009', 'YOUR_USER_ID_HERE', 'TN03AB8834', 'Tata',          'Tigor EV',       2022, 'EV',  'Electric', 'healthy',  79,  41200,  'Dinesh L',      'c1000000-0000-0000-0000-000000000001', '2025-10-20', '2026-04-20'),
  ('va000000-0000-0000-0000-000000000010', 'YOUR_USER_ID_HERE', 'TN18GH7743', 'Tata',          'Prima 4028.S',   2020, 'ICE', 'Diesel',   'at-risk',  55,  121400, 'Vijay N',       'c7000000-0000-0000-0000-000000000007', '2025-09-30', '2026-03-30'),
  ('vb000000-0000-0000-0000-000000000011', 'YOUR_USER_ID_HERE', 'TN55RS2290', 'Mahindra',      'Treo Zor EV',    2023, 'EV',  'Electric', 'healthy',  97,  8900,   'Sathya B',      'c3000000-0000-0000-0000-000000000003', '2026-01-05', '2026-07-05'),
  ('vc000000-0000-0000-0000-000000000012', 'YOUR_USER_ID_HERE', 'TN72KL4456', 'Ashok Leyland', 'U-Truck 1616',   2019, 'ICE', 'Diesel',   'critical', 41,  168000, 'Ravi S',        'c8000000-0000-0000-0000-000000000008', '2025-05-12', '2025-11-12')
ON CONFLICT (id) DO UPDATE SET
  status       = EXCLUDED.status,
  health_score = EXCLUDED.health_score;

-- ============================================================
-- STEP 4: Vehicle Components (5 per vehicle = 60 rows)
-- ============================================================
INSERT INTO vehicle_components (vehicle_id, component_name, health_score, status, wear_rate, last_replaced, predicted_replacement)
VALUES
-- v1: TN09EF7890 (healthy 94)
('v1000000-0000-0000-0000-000000000001','Engine',      96, 'healthy', 0.008, '2025-06-10', '2027-06-10'),
('v1000000-0000-0000-0000-000000000001','Brake System',93, 'healthy', 0.012, '2025-08-15', '2026-08-15'),
('v1000000-0000-0000-0000-000000000001','Suspension',  91, 'healthy', 0.010, '2025-04-20', '2027-04-20'),
('v1000000-0000-0000-0000-000000000001','Tires',       90, 'healthy', 0.018, '2025-10-01', '2026-04-01'),
('v1000000-0000-0000-0000-000000000001','Fuel System', 97, 'healthy', 0.005, '2025-12-10', '2028-12-10'),

-- v2: TN38BK2145 (at-risk 62)
('v2000000-0000-0000-0000-000000000002','Engine',      70, 'at-risk', 0.022, '2024-09-05', '2026-03-05'),
('v2000000-0000-0000-0000-000000000002','Brake System',55, 'at-risk', 0.038, '2024-06-10', '2025-09-10'),
('v2000000-0000-0000-0000-000000000002','Suspension',  60, 'at-risk', 0.030, '2024-07-20', '2025-10-20'),
('v2000000-0000-0000-0000-000000000002','Tires',       65, 'at-risk', 0.042, '2024-08-15', '2026-02-15'),
('v2000000-0000-0000-0000-000000000002','Fuel System', 72, 'at-risk', 0.015, '2025-01-10', '2026-06-10'),

-- v3: TN59MN4532 (critical 38)
('v3000000-0000-0000-0000-000000000003','Engine',      42, 'critical', 0.055, '2023-06-20', '2025-03-20'),
('v3000000-0000-0000-0000-000000000003','Brake System',28, 'critical', 0.088, '2023-04-10', '2024-10-10'),
('v3000000-0000-0000-0000-000000000003','Suspension',  30, 'critical', 0.075, '2023-05-15', '2024-11-15'),
('v3000000-0000-0000-0000-000000000003','Tires',       45, 'critical', 0.062, '2024-01-20', '2025-07-20'),
('v3000000-0000-0000-0000-000000000003','Fuel System', 50, 'at-risk', 0.030, '2024-06-20', '2025-06-20'),

-- v4: TN22XZ9901 (healthy 91 EV)
('v4000000-0000-0000-0000-000000000004','Battery Pack', 93, 'healthy', 0.006, '2025-11-18', '2028-11-18'),
('v4000000-0000-0000-0000-000000000004','Brake System', 95, 'healthy', 0.008, '2025-11-18', '2027-05-18'),
('v4000000-0000-0000-0000-000000000004','Suspension',   89, 'healthy', 0.011, '2025-06-01', '2027-06-01'),
('v4000000-0000-0000-0000-000000000004','Tires',        88, 'healthy', 0.016, '2025-08-20', '2026-02-20'),
('v4000000-0000-0000-0000-000000000004','Thermal Mgmt', 91, 'healthy', 0.004, '2025-11-18', '2027-11-18'),

-- v5: TN07PQ3311 (critical 34)
('v5000000-0000-0000-0000-000000000005','Engine',      28, 'critical', 0.095, '2022-04-10', '2024-10-10'),
('v5000000-0000-0000-0000-000000000005','Brake System',40, 'critical', 0.072, '2023-01-15', '2025-01-15'),
('v5000000-0000-0000-0000-000000000005','Suspension',  38, 'critical', 0.080, '2023-02-20', '2024-08-20'),
('v5000000-0000-0000-0000-000000000005','Tires',       42, 'critical', 0.065, '2023-06-10', '2024-12-10'),
('v5000000-0000-0000-0000-000000000005','Fuel System', 35, 'critical', 0.058, '2022-10-10', '2024-04-10'),

-- v6: TN45YA6678 (at-risk 57)
('v6000000-0000-0000-0000-000000000006','Engine',      65, 'at-risk', 0.025, '2024-08-25', '2026-02-25'),
('v6000000-0000-0000-0000-000000000006','Brake System',52, 'at-risk', 0.042, '2024-05-10', '2025-11-10'),
('v6000000-0000-0000-0000-000000000006','Suspension',  60, 'at-risk', 0.032, '2024-07-15', '2026-01-15'),
('v6000000-0000-0000-0000-000000000006','Tires',       55, 'at-risk', 0.048, '2024-06-20', '2025-12-20'),
('v6000000-0000-0000-0000-000000000006','Air Filter',  48, 'at-risk', 0.055, '2024-03-10', '2025-03-10'),

-- v7: TN63CD1122 (healthy 88 EV)
('v7000000-0000-0000-0000-000000000007','Battery Pack', 91, 'healthy', 0.007, '2025-12-01', '2028-12-01'),
('v7000000-0000-0000-0000-000000000007','Brake System', 89, 'healthy', 0.010, '2025-09-01', '2027-03-01'),
('v7000000-0000-0000-0000-000000000007','Suspension',   85, 'healthy', 0.013, '2025-06-15', '2027-06-15'),
('v7000000-0000-0000-0000-000000000007','Tires',        84, 'healthy', 0.020, '2025-07-10', '2026-01-10'),
('v7000000-0000-0000-0000-000000000007','Thermal Mgmt', 90, 'healthy', 0.005, '2025-12-01', '2028-12-01'),

-- v8: TN11WR5567 (at-risk 49 CNG)
('v8000000-0000-0000-0000-000000000008','Engine',       55, 'at-risk', 0.040, '2024-07-15', '2025-07-15'),
('v8000000-0000-0000-0000-000000000008','CNG System',   42, 'critical', 0.058, '2023-11-10', '2024-11-10'),
('v8000000-0000-0000-0000-000000000008','Brake System', 50, 'at-risk', 0.052, '2024-04-20', '2025-04-20'),
('v8000000-0000-0000-0000-000000000008','Suspension',   48, 'at-risk', 0.055, '2024-03-10', '2025-03-10'),
('v8000000-0000-0000-0000-000000000008','Tires',        52, 'at-risk', 0.060, '2024-02-15', '2025-08-15'),

-- v9: TN03AB8834 (healthy 79 EV)
('v9000000-0000-0000-0000-000000000009','Battery Pack', 82, 'healthy', 0.010, '2025-10-20', '2028-04-20'),
('v9000000-0000-0000-0000-000000000009','Brake System', 80, 'healthy', 0.015, '2025-07-10', '2026-07-10'),
('v9000000-0000-0000-0000-000000000009','Suspension',   76, 'at-risk', 0.022, '2025-04-15', '2026-10-15'),
('v9000000-0000-0000-0000-000000000009','Tires',        78, 'at-risk', 0.028, '2025-05-20', '2025-11-20'),
('v9000000-0000-0000-0000-000000000009','Thermal Mgmt', 83, 'healthy', 0.006, '2025-10-20', '2028-10-20'),

-- v10: TN18GH7743 (at-risk 55)
('va000000-0000-0000-0000-000000000010','Engine',      60, 'at-risk', 0.035, '2024-09-30', '2025-09-30'),
('va000000-0000-0000-0000-000000000010','Brake System',52, 'at-risk', 0.045, '2024-06-15', '2025-06-15'),
('va000000-0000-0000-0000-000000000010','Suspension',  55, 'at-risk', 0.038, '2024-07-20', '2025-07-20'),
('va000000-0000-0000-0000-000000000010','Tires',       50, 'at-risk', 0.055, '2024-05-10', '2025-05-10'),
('va000000-0000-0000-0000-000000000010','Transmission',58, 'at-risk', 0.042, '2024-08-01', '2025-08-01'),

-- v11: TN55RS2290 (healthy 97 EV)
('vb000000-0000-0000-0000-000000000011','Battery Pack', 98, 'healthy', 0.003, '2026-01-05', '2029-01-05'),
('vb000000-0000-0000-0000-000000000011','Brake System', 97, 'healthy', 0.005, '2026-01-05', '2028-01-05'),
('vb000000-0000-0000-0000-000000000011','Suspension',   96, 'healthy', 0.007, '2026-01-05', '2028-01-05'),
('vb000000-0000-0000-0000-000000000011','Tires',        95, 'healthy', 0.010, '2026-01-05', '2026-07-05'),
('vb000000-0000-0000-0000-000000000011','Thermal Mgmt', 98, 'healthy', 0.002, '2026-01-05', '2029-01-05'),

-- v12: TN72KL4456 (critical 41)
('vc000000-0000-0000-0000-000000000012','Engine',       38, 'critical', 0.082, '2022-05-12', '2024-05-12'),
('vc000000-0000-0000-0000-000000000012','Brake System', 44, 'critical', 0.068, '2023-02-20', '2024-08-20'),
('vc000000-0000-0000-0000-000000000012','Suspension',   40, 'critical', 0.074, '2023-01-15', '2024-07-15'),
('vc000000-0000-0000-0000-000000000012','Tires',        45, 'critical', 0.062, '2023-03-10', '2024-09-10'),
('vc000000-0000-0000-0000-000000000012','Transmission', 42, 'critical', 0.070, '2022-11-05', '2024-05-05')
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 5: AI Predictions
-- ============================================================
INSERT INTO ai_predictions (
  vehicle_id, prediction_type, component_name, priority,
  confidence_score, confidence_lower, confidence_upper,
  predicted_failure_date, failure_date_earliest, failure_date_latest,
  failure_probability_7d, failure_probability_30d, failure_probability_90d,
  estimated_cost_if_fixed, estimated_cost_if_delayed, cost_of_delay_per_day, roi_if_fixed_now,
  ai_reasoning, causal_factors, data_quality_score, recommendation, is_resolved
) VALUES

-- v3 CRITICAL: Suspension
('v3000000-0000-0000-0000-000000000003', 'failure_imminent', 'Suspension Assembly', 'critical',
 0.91, 0.87, 0.95, '2026-03-18', '2026-03-15', '2026-03-22',
 0.62, 0.89, 0.97, 12500, 58000, 1533, 45500,
 'Madurai road stress index (0.72, rated HIGH) combined with 145,600 km mileage shows progressive suspension failure signature. Spring fatigue and damper oil leak inferred from load-versus-distance anomaly pattern. Tyre damage and frame stress are imminent secondary failures.',
 '[{"factor":"road_stress","weight":0.42},{"factor":"mileage","weight":0.31},{"factor":"driver_behavior","weight":0.27}]',
 0.88, 'Schedule front suspension overhaul — springs and dampers — within 5 days. Do not load vehicle above 60% capacity until serviced.', false),

-- v5 CRITICAL: Engine
('v5000000-0000-0000-0000-000000000005', 'failure_imminent', 'Engine Oil System', 'critical',
 0.94, 0.90, 0.97, '2026-03-16', '2026-03-14', '2026-03-19',
 0.78, 0.95, 0.99, 3800, 28000, 9333, 24200,
 'Oil viscosity degradation at 198,700 km without recent service since April 2025 poses catastrophic engine seizure risk. Salem summer heat (road temp 48°C+) accelerates oil breakdown. Delay cost increases exponentially — every 3 days of operation risks complete engine failure.',
 '[{"factor":"service_overdue_days","weight":0.55},{"factor":"mileage_threshold","weight":0.28},{"factor":"heat_stress","weight":0.17}]',
 0.92, 'Immediate oil flush and filter replacement. Park vehicle until serviced. Do not operate.', false),

-- v12 CRITICAL: Transmission
('vc000000-0000-0000-0000-000000000012', 'failure_predicted', 'Transmission', 'critical',
 0.88, 0.83, 0.93, '2026-03-28', '2026-03-24', '2026-04-02',
 0.45, 0.82, 0.94, 8900, 34000, 925, 25100,
 'Erode-Chennai highway run patterns detected transmission slippage in 4th and 5th gears. Fluid breakdown at 168,000 km with aggressive acceleration patterns. CAN bus data signature matches pre-failure transmission profile from fleet database.',
 '[{"factor":"gear_slip_frequency","weight":0.48},{"factor":"fluid_condition","weight":0.33},{"factor":"route_load","weight":0.19}]',
 0.85, 'Transmission fluid change and full clutch inspection within 2 weeks.', false),

-- v2 HIGH: Brakes
('v2000000-0000-0000-0000-000000000002', 'wear_acceleration', 'Brake Pads', 'high',
 0.91, 0.87, 0.95, '2026-03-22', '2026-03-19', '2026-03-26',
 0.35, 0.72, 0.89, 6200, 19500, 440, 13300,
 'Coimbatore urban driving pattern (avg 78 stops/hour) shows high brake frequency. Estimated 15-20% brake material remaining based on stop-distance degradation curve. Harsh braking count 41 (above fleet average of 22) is accelerating pad consumption.',
 '[{"factor":"stop_frequency","weight":0.44},{"factor":"harsh_braking","weight":0.38},{"factor":"mileage","weight":0.18}]',
 0.89, 'Full brake pad replacement and front rotor inspection within 9 days.', false),

-- v6 MEDIUM: Air Filter
('v6000000-0000-0000-0000-000000000006', 'wear_gradual', 'Air Filter', 'medium',
 0.84, 0.79, 0.89, '2026-04-10', '2026-04-05', '2026-04-16',
 0.08, 0.38, 0.71, 850, 3200, 77, 2350,
 'Tiruppur textile manufacturing dust environment causes rapid filter clogging — 2.8× the normal rate. Engine breathing patterns (intake manifold pressure anomaly) suggest 40-45% restriction. Fuel efficiency has dropped 7% in last 30 days attributable to restricted airflow.',
 '[{"factor":"environment_dust","weight":0.62},{"factor":"filter_age_days","weight":0.25},{"factor":"intake_pressure_delta","weight":0.13}]',
 0.81, 'Air filter replacement within 28 days. Consider upgrading to heavy-duty industrial filter for Tiruppur operations.', false),

-- v8 MEDIUM: CNG System
('v8000000-0000-0000-0000-000000000008', 'wear_gradual', 'CNG Injector System', 'medium',
 0.87, 0.82, 0.92, '2026-04-05', '2026-03-31', '2026-04-10',
 0.12, 0.44, 0.76, 4100, 11200, 222, 7100,
 'Fuel efficiency drop of 18% detected over past 2 months compared to baseline. Trichy CNG quality variance (sulphur content above IS 14076) is accelerating injector fouling. Pattern at 231,000 km matches known fouling profile requiring injector cleaning.',
 '[{"factor":"fuel_efficiency_decline","weight":0.41},{"factor":"mileage","weight":0.32},{"factor":"fuel_quality","weight":0.27}]',
 0.83, 'CNG injector ultrasonic cleaning and pressure valve inspection within 23 days.', false),

-- v10 MEDIUM: Tires
('va000000-0000-0000-0000-000000000010', 'wear_gradual', 'Tires', 'medium',
 0.86, 0.81, 0.91, '2026-04-15', '2026-04-10', '2026-04-20',
 0.15, 0.48, 0.78, 5600, 12800, 219, 7200,
 'Vellore highway stretch shows uneven front tyre wear — estimated 35% more wear on front-left than front-right, indicating wheel alignment drift. Rotation overdue by estimated 8,000 km. Continued operation will cause premature full replacement and suspension stress.',
 '[{"factor":"tyre_wear_asymmetry","weight":0.52},{"factor":"rotation_overdue","weight":0.31},{"factor":"alignment_drift","weight":0.17}]',
 0.82, 'Tyre rotation, wheel alignment check, and front-left tyre replacement within 32 days.', false),

-- v4 LOW: Battery Coolant (EV)
('v4000000-0000-0000-0000-000000000004', 'preventive', 'Battery Thermal System', 'low',
 0.79, 0.74, 0.84, '2026-05-01', '2026-04-25', '2026-05-08',
 0.03, 0.15, 0.45, 2100, 8800, 196, 6700,
 'Chennai summer thermal stress on EV battery system is approaching preventive maintenance threshold. Coolant pH is estimated at 6.8 (below optimal 7.2-8.0) based on thermal profile patterns. Preventive flush at 22,100 km extends battery lifespan by estimated 18-24 months.',
 '[{"factor":"ambient_temperature","weight":0.44},{"factor":"coolant_cycle_count","weight":0.35},{"factor":"ph_estimation","weight":0.21}]',
 0.76, 'EV battery thermal coolant flush before April 2026. Schedule during off-peak (night shift) to minimise downtime.', false),

-- v1 LOW: Tire rotation only
('v1000000-0000-0000-0000-000000000001', 'preventive', 'Tires', 'low',
 0.82, 0.77, 0.87, '2026-06-01', '2026-05-25', '2026-06-08',
 0.02, 0.10, 0.32, 1200, 4500, 112, 3300,
 'Tyre rotation due at approximately 50,000 km (currently 48,200 km). Tread depth is healthy at 94% but rotation prevention prevents uneven wear developing. Chennai urban heat adds minor tyre degradation factor.',
 '[{"factor":"mileage_threshold","weight":0.65},{"factor":"heat_stress","weight":0.35}]',
 0.80, 'Tyre rotation and pressure check at next service interval (approximately 1,800 km).', false)
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 6: Driver Analytics
-- ============================================================
INSERT INTO driver_analytics (vehicle_id, driver_name, overall_score, aggressive_driving_score, over_speeding_incidents, harsh_braking_count, fuel_efficiency_score, impact_on_vehicle, recorded_at)
VALUES
('v3000000-0000-0000-0000-000000000003','Selvam P',      28, 82, 47, 134, 41,
 'HIGH RISK: Driving behaviour is directly contributing to accelerated suspension and brake wear. Harsh braking frequency is 3.4× above fleet average of 39 incidents. Aggressive cornering on Madurai road sections is the primary causal factor in suspension degradation. Estimated ₹18,400 additional annual maintenance cost attributable to driving style.',
 NOW() - INTERVAL '2 days'),

('v5000000-0000-0000-0000-000000000005','Arun Vel',      34, 74, 38, 98, 52,
 'HIGH RISK: Aggressive throttle-brake cycling on Eicher Pro 2049 is exacerbating already-critical engine and fuel system stress. Over-speeding on Salem NH79 detected 38 times in last 30 days. Estimated ₹22,000 additional annual wear cost attributable to driving style. Mandatory coaching recommended before vehicle returns to service.',
 NOW() - INTERVAL '1 day'),

('v2000000-0000-0000-0000-000000000002','Murugan S',     58, 45, 12, 41, 67,
 'MODERATE: Driving patterns contribute to above-average brake wear in Coimbatore urban zones. Stop-start frequency is within acceptable range but the 41 harsh braking incidents indicate room for improvement. Coaching on smooth deceleration and anticipatory driving can recover an estimated ₹4,200/year in maintenance savings.',
 NOW() - INTERVAL '3 days'),

('v1000000-0000-0000-0000-000000000001','Rajesh Kumar',  87, 12,  3,  9, 91,
 'EXCELLENT: Driving behaviour is exemplary and extends component lifespan. Pattern analysis identifies optimal speed progression, minimal harsh events, and fuel-efficient route adherence. Recommended as peer-coaching reference for other drivers. Current driving style contributes to the vehicle being the healthiest in the fleet at 94%.',
 NOW() - INTERVAL '6 hours'),

('v4000000-0000-0000-0000-000000000004','Karthik R',     82, 18,  5, 14, 88,
 'GOOD: EV-optimized driving style with effective regenerative braking usage — 73% of deceleration events use regen. Smooth highway cruising on Chennai routes maintains battery efficiency. Estimated 7% improvement in battery longevity compared to aggressive EV driving pattern.',
 NOW() - INTERVAL '12 hours'),

('v8000000-0000-0000-0000-000000000008','Gopal K',       61, 38, 19, 56, 58,
 'MODERATE: CNG system stress is elevated due to inconsistent throttle patterns causing rich-lean fuel cycling. Fuel waste estimated at 11% above optimal for the Trichy-Thanjavur route. Specific coaching on CNG throttle management and pre-trip warm-up procedures recommended.',
 NOW() - INTERVAL '4 days'),

('v6000000-0000-0000-0000-000000000006','Pradeep M',     65, 32, 8,  28, 72,
 'MODERATE: Generally steady driving but Tiruppur industrial zone stop-start patterns add wear. Air filter clogging rate correlates with engine strain on deceleration. Acceptable performance — routine monitoring sufficient.',
 NOW() - INTERVAL '2 days'),

('v7000000-0000-0000-0000-000000000007','Suresh V',      79, 22, 6,  18, 82,
 'GOOD: Consistent EV driving patterns in Coimbatore. Regenerative braking well utilised. Minor improvement opportunity in highway merging — 6 hard acceleration events detected. Overall positive impact on vehicle health.',
 NOW() - INTERVAL '1 day'),

('v9000000-0000-0000-0000-000000000009','Dinesh L',      71, 28, 9,  22, 76,
 'GOOD: Chennai city driving handled well. Tyre wear pattern slightly uneven due to frequent U-turn maneuvers in dense traffic. Alignment check recommended at next service but driving behaviour is not the primary wear cause.',
 NOW() - INTERVAL '3 days'),

('va000000-0000-0000-0000-000000000010','Vijay N',       54, 48, 16, 44, 61,
 'MODERATE RISK: Vellore-Chennai highway runs show aggressive overtaking patterns contributing to uneven tyre wear. Brake-heavy driving style adds to wear on at-risk vehicle. Targeted highway coaching on braking distance and lane discipline recommended.',
 NOW() - INTERVAL '5 days'),

('vb000000-0000-0000-0000-000000000011','Sathya B',      94, 8,   1,  4,  96,
 'OUTSTANDING: Best driver in the fleet. Near-perfect driving scores across all metrics. Mahindra Treo Zor EV performs exceptionally under this driver. Pattern identified as city delivery optimised — short routes, minimal idle time, maximum regen usage. Recommended for fleet driving excellence award.',
 NOW() - INTERVAL '8 hours'),

('vc000000-0000-0000-0000-000000000012','Ravi S',        42, 62, 24, 78, 48,
 'HIGH RISK: Aggressive gear-changing and high-load highway driving on critical vehicle are accelerating transmission failure. 78 harsh braking incidents in 30 days — highest in fleet. Immediate intervention required. Do not assign to heavy long-haul runs until coaching is completed.',
 NOW() - INTERVAL '2 days')
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 7: Maintenance History
-- ============================================================
INSERT INTO maintenance_history (vehicle_id, maintenance_type, description, cost, parts_replaced, performed_at, performed_by)
VALUES
('v1000000-0000-0000-0000-000000000001','Scheduled Service','Full service — oil change, filter replacement, tyre rotation, brake inspection',4200,'{"Engine Oil 15W40 5L","Oil Filter","Air Filter"}','2025-12-10 09:30:00','Sri Murugan Auto Services, Chennai'),
('v1000000-0000-0000-0000-000000000001','Tyre Replacement','Front tyre replacement due to wear',3800,'{"MRF ZVTS 185/65 R14 x2"}','2025-10-01 11:00:00','Karthik Tyres, Tambaram'),

('v2000000-0000-0000-0000-000000000002','Scheduled Service','Oil change and basic inspection',2800,'{"Engine Oil 10W40 5L","Oil Filter"}','2025-09-05 10:00:00','Mahindra Service Centre, Coimbatore'),
('v2000000-0000-0000-0000-000000000002','Brake Service','Front brake pad replacement',4200,'{"Brake Pads Front Set","Brake Fluid DOT 4"}','2024-06-10 14:00:00','BrakeMaster, Gandhipuram'),

('v3000000-0000-0000-0000-000000000003','Emergency Repair','Rear leaf spring replacement after road damage',8900,'{"Leaf Spring Assembly LH","Shackle Bolts"}','2024-04-10 08:00:00','Sri Lakshmi Auto Works, Madurai'),
('v3000000-0000-0000-0000-000000000003','Scheduled Service','Oil change only (driver reported no issues)',1800,'{"Engine Oil 15W40 5L"}','2025-06-20 09:00:00','Arulmuthu Auto Service, Madurai'),

('v4000000-0000-0000-0000-000000000004','Scheduled Service','EV inspection — battery health check, software update, tyre rotation',3500,'{"N/A - software update only"}','2025-11-18 10:30:00','Tata Authorized EV Service, Anna Nagar'),

('v5000000-0000-0000-0000-000000000005','Scheduled Service','Oil change (last service before current overdue situation)',2200,'{"Engine Oil 15W40 5L","Oil Filter"}','2025-04-10 09:00:00','Salem Truck Service Centre'),
('v5000000-0000-0000-0000-000000000005','Tyre Replacement','Full tyre replacement on all 4 wheels',14800,'{"Apollo EnduRace XT 7.50 R16 x4"}','2023-06-10 10:00:00','National Tyre House, Salem'),

('v8000000-0000-0000-0000-000000000008','CNG Service','CNG kit inspection and pressure test',3200,'{"O-Ring Kit","Pressure Regulator Diaphragm"}','2024-07-15 11:00:00','GreenGas CNG Service, Trichy'),
('v8000000-0000-0000-0000-000000000008','Brake Service','Rear brake drum replacement',5600,'{"Brake Drum Rear x2","Brake Shoe Set"}','2024-04-20 13:00:00','Trichy Brake Centre'),

('vc000000-0000-0000-0000-000000000012','Emergency Repair','Clutch replacement after slippage failure on highway',12400,'{"Clutch Plate","Pressure Plate","Release Bearing"}','2022-11-05 07:00:00','Roadside Emergency — Erode Highway'),
('vc000000-0000-0000-0000-000000000012','Scheduled Service','Oil and filter change',3100,'{"Engine Oil 15W40 7L","Oil Filter","Fuel Filter"}','2025-05-12 09:00:00','Ashok Leyland Authorised ASC, Erode')
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 8: Fleet Stats Cache (will auto-calculate but seed for speed)
-- ============================================================
-- Ensure fleet_stats table exists (add to schema.sql if missing):
-- CREATE TABLE IF NOT EXISTS fleet_stats (
--   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   user_id UUID UNIQUE REFERENCES auth.users(id),
--   total_vehicles INT DEFAULT 0, healthy_vehicles INT DEFAULT 0,
--   at_risk_vehicles INT DEFAULT 0, critical_vehicles INT DEFAULT 0,
--   avg_health_score NUMERIC DEFAULT 0, predicted_savings NUMERIC DEFAULT 0,
--   upcoming_maintenance INT DEFAULT 0, active_alerts INT DEFAULT 0,
--   updated_at TIMESTAMPTZ DEFAULT NOW()
-- );
-- ALTER TABLE fleet_stats ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "fleet_stats_own" ON fleet_stats FOR ALL USING (auth.uid() = user_id);
