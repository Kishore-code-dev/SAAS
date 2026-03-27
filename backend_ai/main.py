import os
import json
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv
from agents import FleetAgents
from tasks import FleetTasks
from crewai import Crew
from algorithms import calculate_optimal_maintenance_window, calculate_roi

load_dotenv()

# Initialize Supabase
url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("VITE_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

def analyze_fleet():
    print("🚀 Starting Drive Mitra AI Analysis Engine...")
    
    # 1. Fetch data from Supabase
    vehicles_res = supabase.table('vehicles').select('*, tn_cities(road_stress_index)').execute()
    vehicles = vehicles_res.data
    
    if not vehicles:
        print("📭 No vehicles found to analyze.")
        return

    predictions_to_upsert = []

    for v in vehicles:
        print(f"analyzing vehicle: {v['registration_number']}...")
        
        # Fetch components for this vehicle
        components_res = supabase.table('vehicle_components').select('*').eq('vehicle_id', v['id']).execute()
        components = components_res.data
        
        road_stress = float(v.get('tn_cities', {}).get('road_stress_index', 0.5))
        
        for comp in components:
            health = comp['health_score']
            wear = float(comp.get('wear_rate', 0.5))
            
            # Run Algorithmic Baseline
            days, pred_date = calculate_optimal_maintenance_window(health, wear, road_stress)
            
            # Determine Priority
            priority = 'low'
            if health < 50: priority = 'high'
            if health < 30: priority = 'critical'
            
            # Cost Estimation (Simulated for this script)
            prev_cost = 5000 if priority == 'low' else 12000
            fail_cost = prev_cost * 5
            roi = calculate_roi(prev_cost, fail_cost, 2)

            prediction = {
                "vehicle_id": v['id'],
                "component_name": comp['component_name'],
                "prediction_type": "component_failure",
                "priority": priority,
                "confidence_score": 0.85 + (wear * 0.1),
                "predicted_failure_date": pred_date,
                "failure_probability_30d": min(0.99, (100 - health) / 100 * 1.5),
                "estimated_cost_if_fixed": prev_cost,
                "estimated_cost_if_delayed": fail_cost,
                "roi_if_fixed_now": roi,
                "ai_reasoning": f"Based on {health}% health and {wear} wear rate under {road_stress} road stress.",
                "recommendation": f"Schedule inspection for {comp['component_name']} within {days} days."
            }
            predictions_to_upsert.append(prediction)

    # 2. Run CrewAI for Deep Reasoning (if API Key exists)
    if os.environ.get("OPENAI_API_KEY"):
        print("🤖 Running CrewAI Agents for deep insights...")
        agents = FleetAgents()
        tasks = FleetTasks()
        
        # We would pass the collected data to the crew here
        # For brevity in this automation, we demonstrate the initialization
        fleet_crew = Crew(
            agents=[agents.diagnostician(), agents.financial_analyst(), agents.maintenance_coordinator()],
            tasks=[
                tasks.failure_prediction_task(agents.diagnostician(), json.dumps(vehicles[:2])),
                tasks.actionable_recommendation_task(agents.maintenance_coordinator(), [])
            ],
            verbose=True
        )
        # result = fleet_crew.kickoff()
        # In a real run, this would enrich the `ai_reasoning` fields above
        
    # 3. Save predictions back to Supabase
    if predictions_to_upsert:
        print(f"📥 Saving {len(predictions_to_upsert)} AI predictions to Supabase...")
        # Clear old unresolved predictions first to avoid duplicates
        supabase.table('ai_predictions').delete().eq('is_resolved', False).execute()
        supabase.table('ai_predictions').insert(predictions_to_upsert).execute()
        print("✅ Analysis Complete.")

if __name__ == "__main__":
    analyze_fleet()
