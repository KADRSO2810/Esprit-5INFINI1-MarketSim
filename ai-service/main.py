import base64
import io
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ConfigDict
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
import joblib

from explainer import compute_xai

app = FastAPI(
    title="Market Simulator AI Stress Testing Service",
    description="Stateless ML & Explainable AI (XAI) microservice for bank stress testing.",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Pydantic Request / Response DTOs ──────────────────────────────────────────

class TrainRow(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    features: Dict[str, float]
    target: float

class TrainRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    model_type: str = Field(default="RANDOM_FOREST", alias="modelType")
    feature_keys: List[str] = Field(alias="featureKeys")
    target_key: str = Field(default="target", alias="targetKey")
    rows: List[TrainRow]

class FeatureImportanceItem(BaseModel):
    feature: str
    importance: float

class TrainResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    model_artifact_b64: str = Field(alias="modelArtifactB64")
    metrics: Dict[str, float]
    feature_importance: List[FeatureImportanceItem] = Field(alias="featureImportance")

class PredictRow(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: Any
    features: Dict[str, float]

class PredictRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    model_artifact_b64: str = Field(alias="modelArtifactB64")
    feature_keys: List[str] = Field(alias="featureKeys")
    rows: List[PredictRow]

class PredictionItem(BaseModel):
    id: Any
    y: float

class PredictResponse(BaseModel):
    predictions: List[PredictionItem]

class ExplainRow(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: Any
    features: Dict[str, float]

class ExplainRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    model_artifact_b64: str = Field(alias="modelArtifactB64")
    feature_keys: List[str] = Field(alias="featureKeys")
    mode: str = Field(default="GLOBAL")
    rows: List[ExplainRow]

# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "UP", "service": "ai-stress-testing", "stateless": True, "version": "2.0.0"}

@app.post("/train", response_model=TrainResponse)
def train_model(req: TrainRequest):
    if not req.rows or len(req.rows) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le dataset doit contenir au minimum 3 observations pour entraîner un modèle."
        )
    if not req.feature_keys:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aucune feature spécifiée pour l'entraînement."
        )

    # 1. Build DataFrame
    rows_data = []
    targets = []
    for r in req.rows:
        feat_dict = {f: float(r.features.get(f, 0.0)) for f in req.feature_keys}
        rows_data.append(feat_dict)
        targets.append(float(r.target))

    X_df = pd.DataFrame(rows_data, columns=req.feature_keys).fillna(0.0)
    y = np.array(targets, dtype=float)

    # 2. Train-test split
    if len(X_df) >= 8:
        X_train, X_test, y_train, y_test = train_test_split(X_df, y, test_size=0.25, random_state=42)
    else:
        X_train, X_test, y_train, y_test = X_df, X_df, y, y

    # 3. Fit RandomForestRegressor
    model = RandomForestRegressor(n_estimators=100, max_depth=8, random_state=42)
    model.fit(X_train, y_train)

    # 4. Evaluate metrics
    y_pred = model.predict(X_test)
    mae = float(mean_absolute_error(y_test, y_pred))
    mse = float(mean_squared_error(y_test, y_pred))
    rmse = float(np.sqrt(mse))
    r2 = float(r2_score(y_test, y_pred)) if len(y_test) > 1 else 1.0

    metrics = {
        "rmse": round(rmse, 4),
        "mae": round(mae, 4),
        "r2": round(r2, 4)
    }

    # 5. Retrain on full dataset for maximum fidelity
    model.fit(X_df, y)

    # 6. Feature importances
    importances = getattr(model, "feature_importances_", np.ones(len(req.feature_keys)) / max(1, len(req.feature_keys)))
    feat_imp = [
        {"feature": f, "importance": round(float(imp), 4)}
        for f, imp in zip(req.feature_keys, importances)
    ]
    feat_imp.sort(key=lambda x: x["importance"], reverse=True)

    # 7. Serialize model to base64
    bio = io.BytesIO()
    joblib.dump(model, bio, compress=3)
    artifact_b64 = base64.b64encode(bio.getvalue()).decode("utf-8")

    return TrainResponse(
        modelArtifactB64=artifact_b64,
        metrics=metrics,
        featureImportance=feat_imp
    )

@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    if not req.model_artifact_b64:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="modelArtifactB64 est requis."
        )

    try:
        raw_bytes = base64.b64decode(req.model_artifact_b64)
        model = joblib.load(io.BytesIO(raw_bytes))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Impossible de désérialiser le modèle : {e}"
        )

    if not req.rows:
        return PredictResponse(predictions=[])

    rows_data = []
    ids = []
    for r in req.rows:
        feat_dict = {f: float(r.features.get(f, 0.0)) for f in req.feature_keys}
        rows_data.append(feat_dict)
        ids.append(r.id)

    X_df = pd.DataFrame(rows_data, columns=req.feature_keys).fillna(0.0)
    preds = model.predict(X_df.values)

    items = [
        PredictionItem(id=row_id, y=round(float(p), 6))
        for row_id, p in zip(ids, preds)
    ]
    return PredictResponse(predictions=items)

@app.post("/explain")
def explain(req: ExplainRequest):
    if not req.model_artifact_b64:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="modelArtifactB64 est requis."
        )

    try:
        raw_bytes = base64.b64decode(req.model_artifact_b64)
        model = joblib.load(io.BytesIO(raw_bytes))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Impossible de désérialiser le modèle : {e}"
        )

    rows_data = []
    ids = []
    for r in req.rows:
        feat_dict = {f: float(r.features.get(f, 0.0)) for f in req.feature_keys}
        rows_data.append(feat_dict)
        ids.append(r.id)

    X_df = pd.DataFrame(rows_data, columns=req.feature_keys).fillna(0.0)
    result = compute_xai(model, req.feature_keys, X_df, ids=ids, mode=req.mode)
    return result

# ── Sentiment Analysis & XAI (Étape 6) ────────────────────────────────────────

from sentiment_analyzer import analyze_single_text

class SentimentItemInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    text: str

class SentimentAnalyzeRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    model: str = "FINBERT"
    items: List[SentimentItemInput]
    with_explanation: bool = Field(default=True, alias="withExplanation")
    top_k: int = Field(default=8, alias="topK")

class SentimentResultItem(BaseModel):
    id: str
    label: str
    scores: Dict[str, float]
    explanation: Optional[Dict[str, Any]] = None

class SentimentAnalyzeResponse(BaseModel):
    results: List[SentimentResultItem]

@app.post("/sentiment/analyze", response_model=SentimentAnalyzeResponse)
def analyze_sentiment_endpoint(req: SentimentAnalyzeRequest):
    if not req.items:
        return SentimentAnalyzeResponse(results=[])

    results = []
    for item in req.items:
        analysis = analyze_single_text(
            text=item.text,
            model_name=req.model,
            with_explanation=req.with_explanation,
            top_k=req.top_k
        )
        results.append(SentimentResultItem(
            id=str(item.id),
            label=analysis["label"],
            scores=analysis["scores"],
            explanation=analysis["explanation"]
        ))

    return SentimentAnalyzeResponse(results=results)

