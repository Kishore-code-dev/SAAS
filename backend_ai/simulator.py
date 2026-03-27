import time
import random
import json
from datetime import datetime

class FleetSimulator:
    def __init__(self):
        self.vehicles = [
            {"id": "v001", "name": "Tata Prima 4028.S", "location": [13.0827, 80.2707]}, # Chennai
            {"id": "v002", "name": "BharatBenz 3523R", "location": [9.9252, 78.1198]},   # Madurai
            {"id": "v003", "name": "Eicher Pro 6055", "location": [11.0168, 76.9558]}   # Coimbatore
        ]
        self.components = ["Engine", "Brakes", "Tires", "Battery"]

    def generate_telemetry(self):
        while True:
            data = []
            for v in self.vehicles:
                # Add some random movement
                v["location"][0] += random.uniform(-0.001, 0.001)
                v["location"][1] += random.uniform(-0.001, 0.001)
                
                # Simulate health metrics
                metrics = {
                    "vehicle_id": v["id"],
                    "vehicle_name": v["name"],
                    "timestamp": datetime.now().isoformat(),
                    "location": v["location"],
                    "health_status": {
                        comp: {
                            "wear_pct": random.randint(10, 85),
                            "temp_c": random.randint(70, 110) if comp == "Engine" else random.randint(30, 60),
                            "vibration_level": round(random.uniform(0.1, 0.8), 2)
                        } for comp in self.components
                    },
                    "fuel_level_pct": random.randint(20, 95),
                    "driver_drowsiness_index": round(random.uniform(0, 0.4), 2)
                }
                
                # Randomly trigger a critical event for testing
                if random.random() < 0.05:
                    comp = random.choice(self.components)
                    metrics["health_status"][comp]["wear_pct"] = 95
                    metrics["health_status"][comp]["temp_c"] += 30
                    print(f"!!! CRITICAL EVENT SIMULATED for {v['id']} ({comp}) !!!")

                data.append(metrics)
            
            # In a real app, this would push to Supabase or a WebSocket
            with open('telemetry_stream.json', 'w') as f:
                json.dump(data, f, indent=2)
            
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Telemetry packet updated.")
            time.sleep(3)

if __name__ == "__main__":
    print("Starting DriveMitra IoT Fleet Simulator...")
    sim = FleetSimulator()
    sim.generate_telemetry()
