// Drive Mitra — Mock Data
// Used by VehicleDetails, Drivers, RoadIntelligence, Maintenance pages

export interface MockVehicle {
  id: string
  registration_number: string
  make: string
  model: string
  year: number
  vehicle_type: 'ICE' | 'EV'
  fuel_type: 'Petrol' | 'Diesel' | 'CNG' | 'Electric'
  status: 'healthy' | 'at-risk' | 'critical'
  health_score: number
  current_mileage: number
  assigned_driver: string
  city: string
  last_service_date: string
  next_service_due: string
}

export interface HealthPrediction {
  component_name: string
  health_score: number
  status: 'healthy' | 'at-risk' | 'critical'
  confidence: number
  days_to_failure?: number
  failure_probability_30d: number
  reasoning: string
}

export interface MaintenanceRecommendation {
  id: string
  vehicle_id?: string
  component_name: string
  action: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  deadline: string
  estimated_cost: number
  cost_if_delayed: number
  savings: number
  ai_reasoning: string
}

export interface DriverBehavior {
  id: string
  driver_name: string
  vehicle_id: string
  registration_number: string
  overall_score: number
  aggressive_driving_score: number
  over_speeding_incidents: number
  harsh_braking_count: number
  fuel_efficiency_score: number
  impact_on_vehicle: string
}

export interface RoadCondition {
  id: string
  route_name: string
  pothole_stress: number
  urban_wear: number
  highway_wear: number
  load_stress: number
  heat_impact: number
  rain_impact: number
  humidity_impact: number
  overall_risk: 'low' | 'moderate' | 'high'
  city: string
}

export const mockVehicles: MockVehicle[] = [
  { id: 'v1', registration_number: 'TN09EF7890', make: 'Tata', model: 'Ace Gold', year: 2021, vehicle_type: 'ICE', fuel_type: 'Diesel', status: 'healthy', health_score: 94, current_mileage: 48200, assigned_driver: 'Rajesh Kumar', city: 'Chennai', last_service_date: '2025-12-10', next_service_due: '2026-06-10' },
  { id: 'v2', registration_number: 'TN38BK2145', make: 'Mahindra', model: 'Bolero Pik-Up', year: 2020, vehicle_type: 'ICE', fuel_type: 'Diesel', status: 'at-risk', health_score: 62, current_mileage: 87340, assigned_driver: 'Murugan S', city: 'Coimbatore', last_service_date: '2025-09-05', next_service_due: '2026-03-05' },
  { id: 'v3', registration_number: 'TN59MN4532', make: 'Ashok Leyland', model: 'Dost+', year: 2019, vehicle_type: 'ICE', fuel_type: 'Diesel', status: 'critical', health_score: 38, current_mileage: 145600, assigned_driver: 'Selvam P', city: 'Madurai', last_service_date: '2025-06-20', next_service_due: '2025-12-20' },
  { id: 'v4', registration_number: 'TN22XZ9901', make: 'Tata', model: 'Nexon EV', year: 2023, vehicle_type: 'EV', fuel_type: 'Electric', status: 'healthy', health_score: 91, current_mileage: 22100, assigned_driver: 'Karthik R', city: 'Chennai', last_service_date: '2025-11-18', next_service_due: '2026-05-18' },
  { id: 'v5', registration_number: 'TN07PQ3311', make: 'Eicher', model: 'Pro 2049', year: 2018, vehicle_type: 'ICE', fuel_type: 'Diesel', status: 'critical', health_score: 34, current_mileage: 198700, assigned_driver: 'Arun Vel', city: 'Salem', last_service_date: '2025-04-10', next_service_due: '2025-10-10' },
  { id: 'v6', registration_number: 'TN45YA6678', make: 'BharatBenz', model: '1217', year: 2022, vehicle_type: 'ICE', fuel_type: 'Diesel', status: 'at-risk', health_score: 57, current_mileage: 72800, assigned_driver: 'Pradeep M', city: 'Tiruppur', last_service_date: '2025-08-25', next_service_due: '2026-02-25' },
  { id: 'v7', registration_number: 'TN63CD1122', make: 'MG', model: 'ZS EV', year: 2023, vehicle_type: 'EV', fuel_type: 'Electric', status: 'healthy', health_score: 88, current_mileage: 18500, assigned_driver: 'Suresh V', city: 'Coimbatore', last_service_date: '2025-12-01', next_service_due: '2026-06-01' },
  { id: 'v8', registration_number: 'TN11WR5567', make: 'Swaraj Mazda', model: 'T810', year: 2017, vehicle_type: 'ICE', fuel_type: 'CNG', status: 'at-risk', health_score: 49, current_mileage: 231000, assigned_driver: 'Gopal K', city: 'Trichy', last_service_date: '2025-07-15', next_service_due: '2026-01-15' },
  { id: 'v9', registration_number: 'TN03AB8834', make: 'Tata', model: 'Tigor EV', year: 2022, vehicle_type: 'EV', fuel_type: 'Electric', status: 'healthy', health_score: 79, current_mileage: 41200, assigned_driver: 'Dinesh L', city: 'Chennai', last_service_date: '2025-10-20', next_service_due: '2026-04-20' },
  { id: 'v10', registration_number: 'TN18GH7743', make: 'Tata', model: 'Prima 4028.S', year: 2020, vehicle_type: 'ICE', fuel_type: 'Diesel', status: 'at-risk', health_score: 55, current_mileage: 121400, assigned_driver: 'Vijay N', city: 'Vellore', last_service_date: '2025-09-30', next_service_due: '2026-03-30' },
  { id: 'v11', registration_number: 'TN55RS2290', make: 'Mahindra', model: 'Treo Zor', year: 2023, vehicle_type: 'EV', fuel_type: 'Electric', status: 'healthy', health_score: 97, current_mileage: 8900, assigned_driver: 'Sathya B', city: 'Madurai', last_service_date: '2026-01-05', next_service_due: '2026-07-05' },
  { id: 'v12', registration_number: 'TN72KL4456', make: 'Ashok Leyland', model: 'U-Truck 1616', year: 2019, vehicle_type: 'ICE', fuel_type: 'Diesel', status: 'critical', health_score: 41, current_mileage: 168000, assigned_driver: 'Ravi S', city: 'Erode', last_service_date: '2025-05-12', next_service_due: '2025-11-12' },
]

export const mockHealthPredictions: HealthPrediction[] = [
  { component_name: 'Engine', health_score: 72, status: 'at-risk', confidence: 87, days_to_failure: 45, failure_probability_30d: 28, reasoning: 'Oil viscosity degradation pattern detected. Mileage and heat stress from Chennai summer indicate elevated wear on cylinder walls.' },
  { component_name: 'Brake System', health_score: 61, status: 'at-risk', confidence: 91, days_to_failure: 28, failure_probability_30d: 42, reasoning: 'Brake pad wear inferred from stop-frequency patterns and load data. Urban stop-go traffic in Chennai accelerates pad consumption.' },
  { component_name: 'Battery', health_score: 88, status: 'healthy', confidence: 94, failure_probability_30d: 5, reasoning: 'State of charge patterns consistent with healthy battery cells. Thermal management working within expected parameters.' },
  { component_name: 'Suspension', health_score: 54, status: 'at-risk', confidence: 83, days_to_failure: 21, failure_probability_30d: 55, reasoning: 'Road stress index for Madurai route is 0.72 (high). Pothole impact frequency suggests spring fatigue and absorber degradation.' },
  { component_name: 'Tires', health_score: 67, status: 'at-risk', confidence: 89, failure_probability_30d: 33, reasoning: 'Tread pattern wear inferred from mileage and road surface data. Recommend rotation and pressure check within 2 weeks.' },
]

export const mockMaintenanceRecommendations: MaintenanceRecommendation[] = [
  { id: 'm1', vehicle_id: 'v5', component_name: 'Engine Oil System', action: 'Immediate oil flush and filter replacement', priority: 'critical', deadline: '2026-03-16', estimated_cost: 3800, cost_if_delayed: 28000, savings: 24200, ai_reasoning: 'Oil degradation at 198,700 km without recent service poses catastrophic engine seizure risk. Delay cost increases exponentially within 3 days.' },
  { id: 'm2', vehicle_id: 'v3', component_name: 'Suspension Assembly', action: 'Front suspension overhaul — springs and dampers', priority: 'critical', deadline: '2026-03-18', estimated_cost: 12500, cost_if_delayed: 58000, savings: 45500, ai_reasoning: 'Madurai road stress index combined with 145,600 km mileage shows progressive suspension failure signature. Tyre damage and frame stress imminent.' },
  { id: 'm3', vehicle_id: 'v2', component_name: 'Brake Pads', action: 'Full brake pad replacement + rotor inspection', priority: 'high', deadline: '2026-03-22', estimated_cost: 6200, cost_if_delayed: 19500, savings: 13300, ai_reasoning: 'Coimbatore urban driving pattern shows high brake frequency. Estimated 15% brake material remaining — safety-critical threshold.' },
  { id: 'm4', vehicle_id: 'v12', component_name: 'Transmission', action: 'Transmission fluid change and clutch inspection', priority: 'high', deadline: '2026-03-28', estimated_cost: 8900, cost_if_delayed: 34000, savings: 25100, ai_reasoning: 'Erode-Chennai highway run patterns suggest transmission slippage in upper gears. Fluid breakdown confirmed by load-versus-RPM anomalies.' },
  { id: 'm5', vehicle_id: 'v8', component_name: 'CNG System', action: 'CNG injector cleaning and valve inspection', priority: 'medium', deadline: '2026-04-05', estimated_cost: 4100, cost_if_delayed: 11200, savings: 7100, ai_reasoning: 'Fuel efficiency drop of 18% detected over past 2 months. CNG injector fouling pattern at 231,000 km mileage is predictable and addressable.' },
  { id: 'm6', vehicle_id: 'v6', component_name: 'Air Filter', action: 'Air filter replacement', priority: 'medium', deadline: '2026-04-10', estimated_cost: 850, cost_if_delayed: 3200, savings: 2350, ai_reasoning: 'Tiruppur textile dust environment causes rapid filter clogging. Engine breathing patterns suggest 40% restriction — fuel efficiency impacted.' },
  { id: 'm7', vehicle_id: 'v10', component_name: 'Tires', action: 'Tyre rotation + front tyre replacement', priority: 'medium', deadline: '2026-04-15', estimated_cost: 5600, cost_if_delayed: 12800, savings: 7200, ai_reasoning: 'Vellore highway stretch shows uneven front tyre wear. Rotation overdue by estimated 8,000 km based on mileage since last service.' },
  { id: 'm8', vehicle_id: 'v4', component_name: 'Battery Coolant', action: 'EV battery thermal coolant flush', priority: 'low', deadline: '2026-05-01', estimated_cost: 2100, cost_if_delayed: 8800, savings: 6700, ai_reasoning: 'Chennai summer thermal stress on EV battery system. Preventive coolant flush at 22,100 km extends battery lifespan by estimated 18 months.' },
]

export const mockDriverBehaviors: DriverBehavior[] = [
  { id: 'd1', driver_name: 'Selvam P', vehicle_id: 'v3', registration_number: 'TN59MN4532', overall_score: 28, aggressive_driving_score: 82, over_speeding_incidents: 47, harsh_braking_count: 134, fuel_efficiency_score: 41, impact_on_vehicle: 'HIGH RISK: Driving behaviour is directly contributing to accelerated suspension and brake wear. Harsh braking frequency 3.4× above fleet average.' },
  { id: 'd2', driver_name: 'Arun Vel', vehicle_id: 'v5', registration_number: 'TN07PQ3311', overall_score: 34, aggressive_driving_score: 74, over_speeding_incidents: 38, harsh_braking_count: 98, fuel_efficiency_score: 52, impact_on_vehicle: 'HIGH RISK: Aggressive driving on Eicher Pro exacerbating already-critical engine and transmission stress. Estimated ₹18,000 additional annual wear cost attributable to driving style.' },
  { id: 'd3', driver_name: 'Murugan S', vehicle_id: 'v2', registration_number: 'TN38BK2145', overall_score: 58, aggressive_driving_score: 45, over_speeding_incidents: 12, harsh_braking_count: 41, fuel_efficiency_score: 67, impact_on_vehicle: 'MODERATE: Driving patterns contribute to above-average brake wear. Coaching on smooth deceleration can recover ₹4,200/year in maintenance savings.' },
  { id: 'd4', driver_name: 'Rajesh Kumar', vehicle_id: 'v1', registration_number: 'TN09EF7890', overall_score: 87, aggressive_driving_score: 12, over_speeding_incidents: 3, harsh_braking_count: 9, fuel_efficiency_score: 91, impact_on_vehicle: 'EXCELLENT: Driving behaviour extends component lifespan. Pattern recognized as optimal for Tata Ace Gold under Chennai urban conditions.' },
  { id: 'd5', driver_name: 'Karthik R', vehicle_id: 'v4', registration_number: 'TN22XZ9901', overall_score: 82, aggressive_driving_score: 18, over_speeding_incidents: 5, harsh_braking_count: 14, fuel_efficiency_score: 88, impact_on_vehicle: 'GOOD: EV-optimized driving style with effective regenerative braking usage. Battery health benefit estimated at 7% improvement in longevity.' },
  { id: 'd6', driver_name: 'Gopal K', vehicle_id: 'v8', registration_number: 'TN11WR5567', overall_score: 61, aggressive_driving_score: 38, over_speeding_incidents: 19, harsh_braking_count: 56, fuel_efficiency_score: 58, impact_on_vehicle: 'MODERATE: CNG system stress elevated due to inconsistent throttle patterns. Fuel waste estimated at 11% above optimal for this route.' },
]

export const mockRoadConditions: RoadCondition[] = [
  { id: 'r1', route_name: 'Chennai — Tambaram (NH32)', pothole_stress: 34, urban_wear: 72, highway_wear: 45, load_stress: 58, heat_impact: 81, rain_impact: 67, humidity_impact: 74, overall_risk: 'moderate', city: 'Chennai' },
  { id: 'r2', route_name: 'Coimbatore — Pollachi (NH83)', pothole_stress: 48, urban_wear: 55, highway_wear: 38, load_stress: 62, heat_impact: 77, rain_impact: 55, humidity_impact: 60, overall_risk: 'moderate', city: 'Coimbatore' },
  { id: 'r3', route_name: 'Madurai — Dindigul (NH44)', pothole_stress: 62, urban_wear: 68, highway_wear: 42, load_stress: 74, heat_impact: 88, rain_impact: 42, humidity_impact: 52, overall_risk: 'high', city: 'Madurai' },
  { id: 'r4', route_name: 'Salem — Attur (NH79)', pothole_stress: 55, urban_wear: 48, highway_wear: 51, load_stress: 66, heat_impact: 82, rain_impact: 38, humidity_impact: 45, overall_risk: 'high', city: 'Salem' },
  { id: 'r5', route_name: 'Trichy — Thanjavur (NH36)', pothole_stress: 41, urban_wear: 52, highway_wear: 44, load_stress: 58, heat_impact: 79, rain_impact: 61, humidity_impact: 69, overall_risk: 'moderate', city: 'Trichy' },
  { id: 'r6', route_name: 'Tiruppur — Erode (NH948)', pothole_stress: 18, urban_wear: 44, highway_wear: 52, load_stress: 71, heat_impact: 75, rain_impact: 48, humidity_impact: 55, overall_risk: 'low', city: 'Tiruppur' },
]

export const fleetHealthChartData = [
  { month: 'Sep', actual: 82, predicted: 80 },
  { month: 'Oct', actual: 79, predicted: 78 },
  { month: 'Nov', actual: 76, predicted: 77 },
  { month: 'Dec', actual: 74, predicted: 72 },
  { month: 'Jan', actual: 71, predicted: 70 },
  { month: 'Feb', actual: 68, predicted: 67 },
  { month: 'Mar', actual: 66, predicted: null },
  { month: 'Apr', actual: null, predicted: 63 },
  { month: 'May', actual: null, predicted: 59 },
  { month: 'Jun', actual: null, predicted: 56 },
]

export const costSavingsChartData = [
  { month: 'Oct', realized: 45000, potential: 68000 },
  { month: 'Nov', realized: 62000, potential: 82000 },
  { month: 'Dec', realized: 78000, potential: 95000 },
  { month: 'Jan', realized: 92000, potential: 115000 },
  { month: 'Feb', realized: 108000, potential: 128000 },
  { month: 'Mar', realized: 124000, potential: 142000 },
]
