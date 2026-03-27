import os
import joblib
import numpy as np
from datetime import datetime, timedelta

# Load Model Once Globally
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'models', 'failure_predictor.joblib')
_predictor_model = None

if os.path.exists(MODEL_PATH):
    try:
        _predictor_model = joblib.load(MODEL_PATH)
        print("🧠 AI Model loaded successfully for prediction.")
    except Exception as e:
        print(f"⚠️ Failed to load ML model: {e}. Falling back to algorithmic baseline.")

def calculate_optimal_maintenance_window(health_score, wear_rate, road_stress):
    """
    Calculates the OMW (Optimal Maintenance Window) in days.
    If ML model is trained, it uses Random Forest to predict failure.
    Else falls back to basic deterministic algorithm.
    """
    if _predictor_model is not None:
        # Use ML Model
        # Input format: dataframe or 2D array matching training features
        # [[health_score, wear_rate, road_stress]]
        features = np.array([[health_score, wear_rate, road_stress]])
        predicted_days = float(_predictor_model.predict(features)[0])
        
        # Apply strict 20% safety buffer for Optimal Maintenance
        omw_days = max(1, int(predicted_days * 0.8))
        predicted_date = datetime.now() + timedelta(days=omw_days)
        return omw_days, predicted_date.strftime('%Y-%m-%d')
    
    # Fallback Algorithmic Baseline
    # Base RUL (Remaining Useful Life)
    rul = health_score 
    
    # Stress Adjustment
    # If road stress is 0.8 (high), wear is accelerated
    effective_wear_rate = wear_rate * (1 + road_stress)
    
    # Days Until Critical (Threshold 20%)
    days_to_critical = (health_score - 20) / (effective_wear_rate or 0.1)
    
    # Safety Buffer (0.8 for 20% margin)
    omw_days = max(1, int(days_to_critical * 0.8))
    
    predicted_date = datetime.now() + timedelta(days=omw_days)
    return omw_days, predicted_date.strftime('%Y-%m-%d')

def calculate_roi(preventive_cost, failure_cost, downtime_days, revenue_per_day=15000):
    """
    ROI = (Failure Cost + Lost Revenue) - Preventive Cost
    """
    total_failure_cost = failure_cost + (downtime_days * revenue_per_day)
    return total_failure_cost - preventive_cost
