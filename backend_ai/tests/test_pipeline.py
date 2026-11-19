import os
import random
import sys
import types
import unittest
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Stub optional external AI/DB clients before importing main
for optional_mod, attrs in [
    ("supabase", {"create_client": lambda *a, **kw: None, "Client": object}),
    ("dotenv", {"load_dotenv": lambda *a, **kw: None}),
    ("crewai", {"Crew": object}),
    ("agents", {"FleetAgents": object}),
    ("tasks", {"FleetTasks": object}),
]:
    if optional_mod not in sys.modules:
        stub = types.ModuleType(optional_mod)
        for k, v in attrs.items():
            setattr(stub, k, v)
        sys.modules[optional_mod] = stub

import main  # noqa: E402
from simulator import FleetSimulator  # noqa: E402


class _Result:
    def __init__(self, data):
        self.data = data


class _MockTable:
    def __init__(self, table_name, store, calls):
        self.table_name = table_name
        self.store = store
        self.calls = calls
        self.op = None
        self.filters = []
        self.in_filters = {}
        self.payload = None

    def select(self, *_args):
        self.op = "select"
        return self

    def delete(self):
        self.op = "delete"
        return self

    def insert(self, payload):
        self.op = "insert"
        self.payload = payload
        return self

    def eq(self, col, val):
        self.filters.append((col, val))
        return self

    def in_(self, col, vals):
        self.in_filters[col] = list(vals)
        return self

    def execute(self):
        self.calls.append((self.table_name, self.op, list(self.filters), dict(self.in_filters)))
        if self.op == "select":
            rows = list(self.store.get(self.table_name, []))
            for col, val in self.filters:
                rows = [r for r in rows if r.get(col) == val]
            return _Result(rows)
        if self.op == "delete" and self.table_name == "ai_predictions":
            kept = []
            for row in self.store["ai_predictions"]:
                match_eq = all(row.get(col) == val for col, val in self.filters)
                match_in = all(row.get(col) in vals for col, vals in self.in_filters.items())
                if not (match_eq and match_in):
                    kept.append(row)
            self.store["ai_predictions"] = kept
            return _Result([])
        if self.op == "insert" and self.table_name == "ai_predictions":
            self.store["ai_predictions"].extend(self.payload)
            return _Result(self.payload)
        return _Result([])


class _MockSupabase:
    def __init__(self, store):
        self.store = store
        self.calls = []

    def table(self, name):
        return _MockTable(name, self.store, self.calls)


class TestDriveMitraPipelineAndSimulator(unittest.TestCase):
    def test_simulator_generate_packet_tyres_spelling_and_bounds(self):
        sim = FleetSimulator()
        rng = random.Random(42)
        fixed_now = datetime(2026, 6, 15, 10, 0, tzinfo=timezone.utc)
        packet = sim.generate_packet(now=fixed_now, rng=rng)

        self.assertEqual(len(packet), 3)
        for entry in packet:
            self.assertIn("Tyres", entry["health_status"])
            self.assertNotIn("Tires", entry["health_status"])
            lat, lng = entry["location"]
            self.assertTrue(-90 <= lat <= 90)
            self.assertTrue(-180 <= lng <= 180)
            self.assertGreaterEqual(entry["fuel_level_pct"], 20)
            self.assertLessEqual(entry["fuel_level_pct"], 95)

    def test_analyze_fleet_scopes_unresolved_cleanup_to_analyzed_vehicles(self):
        store = {
            "vehicles": [
                {
                    "id": "veh-1",
                    "organization_id": "org-kaveri",
                    "registration_number": "TN 58 AB 4321",
                    "decommissioned": False,
                    "tn_cities": {"road_stress_index": 0.78},
                },
                {
                    "id": "veh-arch",
                    "organization_id": "org-kaveri",
                    "registration_number": "TN 58 OLD 1",
                    "decommissioned": True,
                    "tn_cities": {"road_stress_index": 0.5},
                },
            ],
            "vehicle_components": [
                {
                    "vehicle_id": "veh-1",
                    "component_name": "Brakes",
                    "health_score": 42,
                    "wear_rate": 0.6,
                }
            ],
            "ai_predictions": [
                {
                    "id": "pred-other-org",
                    "vehicle_id": "veh-other-org",
                    "is_resolved": False,
                },
                {
                    "id": "pred-veh-1-old",
                    "vehicle_id": "veh-1",
                    "is_resolved": False,
                },
            ],
        }
        mock_client = _MockSupabase(store)
        orig_create_client = main.create_client
        orig_url = os.environ.get("VITE_SUPABASE_URL")
        orig_key = os.environ.get("VITE_SUPABASE_ANON_KEY")
        orig_openai = os.environ.pop("OPENAI_API_KEY", None)

        try:
            main.create_client = lambda *_a, **_kw: mock_client
            os.environ["VITE_SUPABASE_URL"] = "https://example-fleet.supabase.co"
            os.environ["VITE_SUPABASE_ANON_KEY"] = "anon-valid-test-key"
            main.analyze_fleet()
        finally:
            main.create_client = orig_create_client
            if orig_url is None:
                os.environ.pop("VITE_SUPABASE_URL", None)
            else:
                os.environ["VITE_SUPABASE_URL"] = orig_url
            if orig_key is None:
                os.environ.pop("VITE_SUPABASE_ANON_KEY", None)
            else:
                os.environ["VITE_SUPABASE_ANON_KEY"] = orig_key
            if orig_openai is not None:
                os.environ["OPENAI_API_KEY"] = orig_openai

        # Other org/vehicle unresolved prediction MUST survive; veh-1 old replaced by new
        surviving_ids = [p.get("id") for p in store["ai_predictions"]]
        self.assertIn("pred-other-org", surviving_ids)
        self.assertNotIn("pred-veh-1-old", surviving_ids)
        self.assertTrue(any(p.get("vehicle_id") == "veh-1" for p in store["ai_predictions"]))
        # Verify in_('vehicle_id', ['veh-1']) filter was used on delete
        delete_calls = [c for c in mock_client.calls if c[0] == "ai_predictions" and c[1] == "delete"]
        self.assertEqual(len(delete_calls), 1)
        self.assertEqual(delete_calls[0][3], {"vehicle_id": ["veh-1"]})


if __name__ == "__main__":
    unittest.main()
