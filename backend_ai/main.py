import os
import json
from supabase import create_client, Client
from dotenv import load_dotenv
from agents import FleetAgents
from tasks import FleetTasks
from crewai import Crew
from algorithms import calculate_optimal_maintenance_window, calculate_roi, clamp_confidence

load_dotenv()


def build_prediction_payload(vehicle, comp):
    """Build a validated prediction dict or return None if data is insufficient."""
    city_info = vehicle.get('tn_cities') or {}
    if not isinstance(city_info, dict):
        city_info = {}
    road_stress = float(city_info.get('road_stress_index') or 0.5)

    health = comp.get('health_score')
    wear = comp.get('wear_rate') if comp.get('wear_rate') is not None else 0.5

    days, pred_date_or_reason = calculate_optimal_maintenance_window(health, wear, road_stress)
    if days is None:
        return None

    health_val = float(health)
    wear_val = float(wear)
    priority = 'low'
    if health_val < 50:
        priority = 'high'
    if health_val < 30:
        priority = 'critical'

    prev_cost = 5000 if priority == 'low' else 12000
    fail_cost = prev_cost * 5
    roi = calculate_roi(prev_cost, fail_cost, 2)

    return {
        "vehicle_id": vehicle['id'],
        "organization_id": vehicle.get('organization_id'),
        "component_name": comp['component_name'],
        "prediction_type": "component_failure",
        "priority": priority,
        "confidence_score": clamp_confidence(0.85 + (wear_val * 0.1)),
        "predicted_failure_date": pred_date_or_reason,
        "failure_probability_30d": clamp_confidence((100 - health_val) / 100 * 1.5),
        "estimated_cost_if_fixed": prev_cost,
        "estimated_cost_if_delayed": fail_cost,
        "roi_if_fixed_now": roi,
        "ai_reasoning": f"Based on {health_val}% health and {wear_val} wear rate under {road_stress} road stress.",
        "recommendation": f"Schedule inspection for {comp['component_name']} within {days} days.",
    }


def analyze_fleet():
    print("Starting DriveMitra AI Analysis Engine...")

    url = os.environ.get("VITE_SUPABASE_URL")
    key = os.environ.get("VITE_SUPABASE_ANON_KEY")
    if not url or not key or "placeholder.supabase.co" in url or key == "placeholder-key":
        raise RuntimeError("Missing valid VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment configuration.")

    supabase: Client = create_client(url, key)

    vehicles_res = supabase.table('vehicles').select('*, tn_cities(road_stress_index)').eq('decommissioned', False).execute()
    vehicles = vehicles_res.data or []

    if not vehicles:
        print("No active vehicles found to analyze.")
        return

    predictions_to_upsert = []

    for v in vehicles:
        print(f"Analyzing vehicle: {v.get('registration_number', v['id'])}...")
        components_res = supabase.table('vehicle_components').select('*').eq('vehicle_id', v['id']).execute()
        components = components_res.data or []

        for comp in components:
            payload = build_prediction_payload(v, comp)
            if payload is not None:
                predictions_to_upsert.append(payload)

    if os.environ.get("OPENAI_API_KEY"):
        print("Running CrewAI Agents for deep insights...")
        agents = FleetAgents()
        tasks = FleetTasks()
        Crew(
            agents=[agents.diagnostician(), agents.financial_analyst(), agents.maintenance_coordinator()],
            tasks=[
                tasks.failure_prediction_task(agents.diagnostician(), json.dumps(vehicles[:2])),
                tasks.actionable_recommendation_task(agents.maintenance_coordinator(), []),
            ],
            verbose=True,
        )

    if predictions_to_upsert:
        analyzed_vehicle_ids = sorted({p["vehicle_id"] for p in predictions_to_upsert})
        print(f"Saving {len(predictions_to_upsert)} AI predictions across {len(analyzed_vehicle_ids)} vehicle(s) to Supabase...")
        (
            supabase.table('ai_predictions')
            .delete()
            .eq('is_resolved', False)
            .in_('vehicle_id', analyzed_vehicle_ids)
            .execute()
        )
        supabase.table('ai_predictions').insert(predictions_to_upsert).execute()
        print("Analysis Complete.")


if __name__ == "__main__":
    analyze_fleet()
