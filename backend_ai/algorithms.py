import math
import os
from datetime import datetime, timedelta

try:
    import joblib
except ImportError:
    joblib = None

try:
    import numpy as np
except ImportError:
    np = None

# Load Model Once Globally
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'models', 'failure_predictor.joblib')
_predictor_model = None

if joblib is not None and os.path.exists(MODEL_PATH):
    try:
        _predictor_model = joblib.load(MODEL_PATH)
        print("AI Model loaded successfully for prediction.")
    except Exception as e:
        print(f"Failed to load ML model: {e}. Falling back to algorithmic baseline.")


def clamp_confidence(score):
    """Ensure confidence scores stay strictly within [0.0, 0.99]."""
    try:
        val = float(score)
    except (TypeError, ValueError):
        return 0.0
    if not math.isfinite(val):
        return 0.0
    return round(max(0.0, min(0.99, val)), 3)


def validate_prediction_inputs(health_score, wear_rate, road_stress):
    """Validate model inputs and refuse to manufacture forecasts for missing/invalid data."""
    if health_score is None or wear_rate is None or road_stress is None:
        return False, "Missing required health_score, wear_rate, or road_stress metric."
    try:
        h = float(health_score)
        w = float(wear_rate)
        r = float(road_stress)
    except (TypeError, ValueError):
        return False, "Prediction inputs must be numeric."
    if not (math.isfinite(h) and math.isfinite(w) and math.isfinite(r)):
        return False, "Prediction inputs must be finite numbers."
    if h <= 0 or h > 100:
        return False, "health_score must be within (0, 100]."
    if w <= 0:
        return False, "wear_rate must be positive."
    if r < 0 or r > 1.5:
        return False, "road_stress must be within [0, 1.5]."
    return True, None


def calculate_optimal_maintenance_window(health_score, wear_rate, road_stress):
    """
    Calculates the OMW (Optimal Maintenance Window) in days.
    Returns (None, reason) when inputs are missing or invalid.
    """
    valid, reason = validate_prediction_inputs(health_score, wear_rate, road_stress)
    if not valid:
        return None, reason

    health_val = float(health_score)
    wear_val = float(wear_rate)
    stress_val = float(road_stress)

    if _predictor_model is not None and np is not None:
        features = np.array([[health_val, wear_val, stress_val]])
        predicted_days = float(_predictor_model.predict(features)[0])
        omw_days = max(1, int(predicted_days * 0.8))
        predicted_date = datetime.now() + timedelta(days=omw_days)
        return omw_days, predicted_date.strftime('%Y-%m-%d')

    effective_wear_rate = max(0.1, wear_val * (1 + stress_val))
    days_to_critical = max(1.0, (health_val - 20.0) / effective_wear_rate)
    omw_days = max(1, int(days_to_critical * 0.8))
    predicted_date = datetime.now() + timedelta(days=omw_days)
    return omw_days, predicted_date.strftime('%Y-%m-%d')


def calculate_roi(preventive_cost, failure_cost, downtime_days, revenue_per_day=15000):
    """
    ROI = (Failure Cost + Lost Revenue) - Preventive Cost
    """
    p_cost = max(0.0, float(preventive_cost or 0))
    f_cost = max(0.0, float(failure_cost or 0))
    d_days = max(0, int(downtime_days or 0))
    rev = max(0.0, float(revenue_per_day or 0))
    total_failure_cost = f_cost + (d_days * rev)
    return total_failure_cost - p_cost
