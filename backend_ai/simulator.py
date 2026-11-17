from datetime import datetime, timezone
import json
import random
import time


class FleetSimulator:
    def __init__(self):
        self.vehicles = [
            {"id": "v001", "name": "Tata Prima 4028.S", "location": [13.0827, 80.2707]},  # Chennai
            {"id": "v002", "name": "BharatBenz 3523R", "location": [9.9252, 78.1198]},   # Madurai
            {"id": "v003", "name": "Eicher Pro 6055", "location": [11.0168, 76.9558]},   # Coimbatore
        ]
        self.components = ["Engine", "Brakes", "Tyres", "Battery"]

    def generate_packet(self, now=None, rng=None):
        """Generate a deterministic-structure telemetry snapshot for all simulated vehicles."""
        generator = rng or random
        stamp = (now or datetime.now(timezone.utc)).isoformat()
        data = []

        for v in self.vehicles:
            # Clamp movement within valid WGS84 / South India operating corridor
            v["location"][0] = round(max(-89.9, min(89.9, v["location"][0] + generator.uniform(-0.001, 0.001))), 6)
            v["location"][1] = round(max(-179.9, min(179.9, v["location"][1] + generator.uniform(-0.001, 0.001))), 6)

            metrics = {
                "vehicle_id": v["id"],
                "vehicle_name": v["name"],
                "timestamp": stamp,
                "location": list(v["location"]),
                "health_status": {
                    comp: {
                        "wear_pct": generator.randint(10, 85),
                        "temp_c": generator.randint(70, 110) if comp == "Engine" else generator.randint(30, 60),
                        "vibration_level": round(generator.uniform(0.1, 0.8), 2),
                    }
                    for comp in self.components
                },
                "fuel_level_pct": generator.randint(20, 95),
                "driver_drowsiness_index": round(generator.uniform(0, 0.4), 2),
            }

            if generator.random() < 0.05:
                comp = generator.choice(self.components)
                metrics["health_status"][comp]["wear_pct"] = 95
                metrics["health_status"][comp]["temp_c"] += 30
                print(f"!!! CRITICAL EVENT SIMULATED for {v['id']} ({comp}) !!!")

            data.append(metrics)

        return data

    def run(self, max_iterations=None, interval_sec=3, output_path="telemetry_stream.json"):
        iteration = 0
        while max_iterations is None or iteration < max_iterations:
            data = self.generate_packet()
            with open(output_path, "w") as f:
                json.dump(data, f, indent=2)

            print(f"[{datetime.now().strftime('%H:%M:%S')}] Telemetry packet updated.")
            iteration += 1
            if max_iterations is None or iteration < max_iterations:
                time.sleep(interval_sec)

    def generate_telemetry(self):
        self.run(max_iterations=None, interval_sec=3)


if __name__ == "__main__":
    print("Starting DriveMitra IoT Fleet Simulator...")
    sim = FleetSimulator()
    sim.generate_telemetry()

