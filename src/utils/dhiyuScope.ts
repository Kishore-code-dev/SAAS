export const DHIYU_SCOPE_REFUSAL =
  'I am Dhiyu, DriveMitra’s Fleet Management AI. I only assist with fleet operations for your active organization—vehicles, live GPS tracking, 5-area predictive health (Fuel, Engine, Tyre, Driver, Vehicle), work orders, parts inventory, Indian compliance expiry, risk radar, and fleet TCO.'

const FLEET_DOMAIN_PATTERN =
  /\b(fleet|vehicle|vehicles|truck|trucks|van|vans|ev|evs|ice|cng|diesel|petrol|fuel|charging|kwh|battery|batteries|odometer|km|mileage|maint|maintenance|repair|repairs|service|servicing|predictive|prediction|predictions|rul|breakdown|downtime|delay|subsystem|subsystems|engine|oil|brake|brakes|rotor|tyre|tyres|tire|tires|axle|tread|transmission|clutch|cooling|coolant|radiator|suspension|damper|work\s*order|inventory|parts|sku|supplier|workshop|vendor|invoice|payable|driver|drivers|licence|license|rto|compliance|puc|fitness|permit|insurance|trip|trips|route|routes|corridor|corridors|geofence|depot|dispute|disputes|safety|harsh|fatigue|overspeed|telematics|telemetry|gps|location|map|risk|radar|alert|alerts|inspection|inspections|financial|financials|spend|cost|costs|tco|saving|savings|upi|receipt|anomaly|anomalies|utilization|health|status|audit|organization|drivemitra|dhiyu|report|reports|csv)\b/i

const OFF_TOPIC_PATTERN =
  /\b(python|javascript|typescript|java|c\+\+|html|css|poem|poetry|story|joke|song|lyrics|recipe|cook|biryani|pasta|movie|cricket|football|soccer|politics|election|bitcoin|crypto|stock\s*market|homework|essay|translate\s+into)\b/i

export function isFleetManagementQuery(
  query: string,
  vehicleRegistrations: string[] = [],
  hasFleetHistory = false,
): boolean {
  const trimmed = query.trim()
  if (!trimmed) return false
  if (OFF_TOPIC_PATTERN.test(trimmed) && !FLEET_DOMAIN_PATTERN.test(trimmed)) {
    return false
  }
  if (FLEET_DOMAIN_PATTERN.test(trimmed)) {
    return true
  }
  const compactQuery = trimmed.replace(/\s+/g, '').toLowerCase()
  if (
    vehicleRegistrations.some((reg) => {
      const compactReg = reg.replace(/\s+/g, '').toLowerCase()
      return compactReg.length >= 4 && compactQuery.includes(compactReg)
    })
  ) {
    return true
  }
  if (/\b[a-z]{2}\s*\d{1,2}\s*[a-z]{1,3}\s*\d{3,4}\b/i.test(trimmed)) {
    return true
  }
  if (
    hasFleetHistory &&
    trimmed.length <= 120 &&
    /^(why|how|which|what|yes|no|more|details|explain|elaborate|summarize|compare|schedule|next)\b/i.test(trimmed)
  ) {
    return true
  }
  return false
}
