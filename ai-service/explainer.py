import numpy as np
import pandas as pd
from typing import List, Dict, Any

def compute_xai(model, feature_keys: List[str], X_df: pd.DataFrame, ids: List[Any], mode: str = "GLOBAL") -> Dict[str, Any]:
    """
    Computes Explainable AI (XAI) metrics using SHAP TreeExplainer if available,
    with a graceful deterministic fallback based on feature importances.
    Returns:
    {
        "global": [{"feature": "...", "importance": ...}, ...],
        "local": [
            {
                "id": "...",
                "baseValue": ...,
                "outputValue": ...,
                "contributions": [{"feature": "...", "value": ..., "contribution": ...}, ...]
            }
        ]
    }
    """
    n_samples, n_features = X_df.shape
    feature_names = list(feature_keys)

    shap_matrix = None
    expected_value = float(np.mean(model.predict(X_df.values))) if n_samples > 0 else 0.0

    try:
        import shap
        explainer = shap.TreeExplainer(model)
        sv = explainer.shap_values(X_df.values)
        if hasattr(sv, "values"):
            shap_matrix = sv.values
        else:
            shap_matrix = np.array(sv)

        if hasattr(explainer, "expected_value"):
            ev = explainer.expected_value
            if isinstance(ev, (list, np.ndarray)):
                expected_value = float(ev[0])
            else:
                expected_value = float(ev)
    except Exception as e:
        # Fallback: distribute prediction difference proportional to feature importances and centered marginals
        importances = getattr(model, "feature_importances_", np.ones(n_features) / max(1, n_features))
        predictions = model.predict(X_df.values) if n_samples > 0 else np.array([])

        feat_means = X_df.values.mean(axis=0) if n_samples > 0 else np.zeros(n_features)
        feat_stds = X_df.values.std(axis=0) if n_samples > 0 else np.ones(n_features)
        feat_stds[feat_stds == 0] = 1.0
        z_scores = (X_df.values - feat_means) / feat_stds

        raw_contrib = z_scores * importances
        row_sums = np.abs(raw_contrib).sum(axis=1, keepdims=True)
        row_sums[row_sums == 0] = 1.0

        pred_deltas = (predictions - expected_value)[:, np.newaxis]
        shap_matrix = (raw_contrib / row_sums) * pred_deltas

    if shap_matrix is None or shap_matrix.ndim != 2:
        shap_matrix = np.zeros((n_samples, n_features))

    # 1. Global Importance
    mean_abs_shap = np.abs(shap_matrix).mean(axis=0)
    total_importance = float(np.sum(mean_abs_shap))
    if total_importance > 0:
        normalized_importance = mean_abs_shap / total_importance
    else:
        normalized_importance = np.ones(n_features) / max(1, n_features)

    global_list = []
    for idx, f_name in enumerate(feature_names):
        global_list.append({
            "feature": f_name,
            "importance": round(float(normalized_importance[idx]), 4)
        })
    global_list.sort(key=lambda x: x["importance"], reverse=True)

    result = {
        "global": global_list,
        "local": []
    }

    if mode.upper() == "GLOBAL" or n_samples == 0:
        return result

    # 2. Local Explanations
    predictions = model.predict(X_df.values)
    local_list = []
    for row_idx in range(n_samples):
        row_id = ids[row_idx] if row_idx < len(ids) else f"row_{row_idx}"
        output_val = float(predictions[row_idx])
        contributions = []
        for feat_idx, f_name in enumerate(feature_names):
            val = float(X_df.iloc[row_idx, feat_idx])
            contrib = float(shap_matrix[row_idx, feat_idx])
            contributions.append({
                "feature": f_name,
                "value": round(val, 4),
                "contribution": round(contrib, 6)
            })
        contributions.sort(key=lambda c: abs(c["contribution"]), reverse=True)
        local_list.append({
            "id": str(row_id),
            "baseValue": round(expected_value, 6),
            "outputValue": round(output_val, 6),
            "contributions": contributions
        })

    result["local"] = local_list
    return result
