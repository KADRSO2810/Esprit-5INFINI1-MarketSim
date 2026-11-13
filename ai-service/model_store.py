import os
import uuid
from typing import Dict, Any, Optional
import joblib

CACHE_DIR = os.path.join(os.path.dirname(__file__), ".models_cache")
os.makedirs(CACHE_DIR, exist_ok=True)

# In-memory registry of trained models: model_id -> dict
_MODELS: Dict[str, Dict[str, Any]] = {}

def save_model(
    model: Any,
    feature_keys: list,
    target_key: str,
    metrics: dict,
    model_type: str = "RANDOM_FOREST"
) -> str:
    model_id = str(uuid.uuid4())
    entry = {
        "model_id": model_id,
        "model": model,
        "feature_keys": feature_keys,
        "target_key": target_key,
        "metrics": metrics,
        "model_type": model_type,
    }
    _MODELS[model_id] = entry
    
    # Save to disk as backup
    try:
        path = os.path.join(CACHE_DIR, f"{model_id}.joblib")
        joblib.dump(entry, path)
    except Exception as e:
        print(f"Warning: could not serialize model {model_id} to disk: {e}")
        
    return model_id

def get_model_entry(model_id: str) -> Optional[Dict[str, Any]]:
    if model_id in _MODELS:
        return _MODELS[model_id]
        
    path = os.path.join(CACHE_DIR, f"{model_id}.joblib")
    if os.path.exists(path):
        try:
            entry = joblib.load(path)
            _MODELS[model_id] = entry
            return entry
        except Exception as e:
            print(f"Error loading model {model_id} from disk: {e}")
            return None
            
    return None
