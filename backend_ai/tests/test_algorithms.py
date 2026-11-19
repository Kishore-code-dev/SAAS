import os
import sys
import types
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

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

from algorithms import (  # noqa: E402
    calculate_optimal_maintenance_window,
    calculate_roi,
    clamp_confidence,
    validate_prediction_inputs,
)
from main import build_prediction_payload  # noqa: E402


class TestDriveMitraAlgorithms(unittest.TestCase):
    def test_clamp_confidence_bounds(self):
        self.assertEqual(clamp_confidence(1.45), 0.99)
        self.assertEqual(clamp_confidence(-0.2), 0.0)
        self.assertEqual(clamp_confidence("invalid"), 0.0)
        self.assertEqual(clamp_confidence(float("nan")), 0.0)
        self.assertEqual(clamp_confidence(0.8426), 0.843)

    def test_validate_prediction_inputs_rejects_missing_or_out_of_range(self):
        ok, msg = validate_prediction_inputs(None, 0.5, 0.7)
        self.assertFalse(ok)
        self.assertIn("Missing", msg)

        ok, msg = validate_prediction_inputs(0, 0.5, 0.7)
        self.assertFalse(ok)
        self.assertIn("health_score", msg)

        ok, msg = validate_prediction_inputs(65, 0, 0.7)
        self.assertFalse(ok)
        self.assertIn("wear_rate", msg)

        ok, msg = validate_prediction_inputs(65, 0.4, 2.5)
        self.assertFalse(ok)
        self.assertIn("road_stress", msg)

        ok, msg = validate_prediction_inputs(65, 0.4, 0.75)
        self.assertTrue(ok)
        self.assertIsNone(msg)

    def test_calculate_optimal_maintenance_window(self):
        days, date_or_err = calculate_optimal_maintenance_window(45, 0.6, 0.78)
        self.assertIsNotNone(days)
        self.assertGreaterEqual(days, 1)
        self.assertRegex(date_or_err, r"^\d{4}-\d{2}-\d{2}$")

        days_bad, reason = calculate_optimal_maintenance_window(0, 0.6, 0.78)
        self.assertIsNone(days_bad)
        self.assertIsInstance(reason, str)

    def test_calculate_roi_handles_non_negative_costs(self):
        roi = calculate_roi(5000, 25000, 2, revenue_per_day=15000)
        self.assertEqual(roi, 50000.0)

    def test_build_prediction_payload_handles_null_tn_cities_and_invalid_component(self):
        vehicle = {
            "id": "veh-1",
            "organization_id": "org-kaveri",
            "tn_cities": None,
        }
        valid_comp = {
            "component_name": "Suspension",
            "health_score": 42,
            "wear_rate": 0.7,
        }
        payload = build_prediction_payload(vehicle, valid_comp)
        self.assertIsNotNone(payload)
        self.assertEqual(payload["priority"], "high")
        self.assertLessEqual(payload["confidence_score"], 0.99)
        self.assertGreaterEqual(payload["confidence_score"], 0.0)

        invalid_comp = {
            "component_name": "Brakes",
            "health_score": None,
            "wear_rate": 0.5,
        }
        self.assertIsNone(build_prediction_payload(vehicle, invalid_comp))


if __name__ == "__main__":
    unittest.main()
