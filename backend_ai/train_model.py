import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
import joblib
import os

def train_health_predictor():
    print("Generating Synthetic Fleet Maintenance Dataset (50,000 samples)...")

    np.random.seed(42)
    num_samples = 50_000

    # Features
    # Health Score from 20 to 100
    health_score = np.random.uniform(20, 100, num_samples)
    # Wear Rate from 0.05 to 1.5 (represents usage intensity)
    wear_rate = np.random.uniform(0.05, 1.5, num_samples)
    # Road Stress Index from 0.1 (highway) to 1.0 (heavy offroad/traffic)
    road_stress = np.random.uniform(0.1, 1.0, num_samples)

    # Target: Days until failure (simulated physical degradation logic)
    # The combination of wear_rate and road_stress accelerates the deterioration of health.
    base_rul = health_score - 20 # Can't drop below 20 safely
    effective_wear = wear_rate * (1 + road_stress)
    
    # Add non-linear interactions & Gaussian noise for realism
    days_to_failure = (base_rul / effective_wear) * np.random.normal(1.0, 0.15, num_samples)
    
    # Hard bounds
    days_to_failure = np.maximum(days_to_failure, 1)

    data = pd.DataFrame({
        'health_score': health_score,
        'wear_rate': wear_rate,
        'road_stress': road_stress,
        'days_to_failure': days_to_failure
    })

    print(f"Dataset generated. Shape: {data.shape}")

    X = data[['health_score', 'wear_rate', 'road_stress']]
    y = data['days_to_failure']

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    print("Training AI Model (Random Forest Regressor)...")
    # Using 100 trees with depth 12 for high accuracy but fast inference
    model = RandomForestRegressor(n_estimators=100, max_depth=12, n_jobs=-1, random_state=42)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)

    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)

    print("===============================")
    print(f"Training Complete!")
    print(f"Mean Absolute Error: {mae:.2f} days")
    print(f"R2 Score (Accuracy): {r2:.4f} ({r2*100:.1f}%)")
    print("===============================\n")

    # Securely Save the Model
    models_dir = os.path.join(os.path.dirname(__file__), 'models')
    os.makedirs(models_dir, exist_ok=True)
    model_path = os.path.join(models_dir, 'failure_predictor.joblib')
    
    joblib.dump(model, model_path)
    print(f"Trained Machine Learning Model securely saved to: {model_path}")

if __name__ == "__main__":
    train_health_predictor()
