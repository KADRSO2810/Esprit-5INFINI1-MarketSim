"""
Financial Sentiment Analysis & XAI Explainer Module.
Supports FinBERT (if transformers & torch are installed) with an automatic,
robust Financial Lexicon (Loughran-McDonald & COVID market vocabulary) + Token Attribution fallback.
"""

import re
import math
from typing import List, Dict, Any, Optional

# Lexique financier de référence (inspiré de Loughran-McDonald & actualités de marché COVID/macro)
FINANCIAL_POSITIVE_LEXICON = {
    "surge": 0.85, "surges": 0.85, "surging": 0.85, "rally": 0.85, "rallies": 0.85, "rallying": 0.85,
    "soar": 0.80, "soars": 0.80, "soaring": 0.80, "jump": 0.75, "jumps": 0.75, "jumped": 0.75,
    "gain": 0.70, "gains": 0.70, "gaining": 0.70, "gained": 0.70, "growth": 0.75, "grew": 0.70,
    "profit": 0.80, "profits": 0.80, "profitable": 0.75, "dividend": 0.65, "dividends": 0.65,
    "rebound": 0.80, "rebounds": 0.80, "rebounding": 0.80, "recovery": 0.75, "recover": 0.70,
    "stimulus": 0.85, "package": 0.50, "record": 0.70, "high": 0.60, "highs": 0.65,
    "bull": 0.75, "bullish": 0.80, "optimism": 0.75, "optimistic": 0.75, "outperform": 0.80,
    "beat": 0.75, "beats": 0.75, "exceed": 0.75, "exceeds": 0.75, "exceeded": 0.75,
    "boost": 0.70, "boosts": 0.70, "boosted": 0.70, "upgrade": 0.75, "upgrades": 0.75,
    "vaccine": 0.80, "reopen": 0.75, "reopening": 0.75, "approval": 0.70, "approved": 0.70,
    "deal": 0.60, "expansion": 0.65, "strong": 0.65, "robust": 0.70, "success": 0.75,
    "innovation": 0.60, "breakthrough": 0.80, "liquidity": 0.55, "support": 0.50
}

FINANCIAL_NEGATIVE_LEXICON = {
    "crash": 0.95, "crashes": 0.95, "crashing": 0.95, "crashed": 0.95,
    "slump": 0.90, "slumps": 0.90, "slumping": 0.90, "slumped": 0.90,
    "plunge": 0.90, "plunges": 0.90, "plunging": 0.90, "plunged": 0.90,
    "collapse": 0.92, "collapses": 0.92, "collapsing": 0.92, "collapsed": 0.92,
    "drop": 0.75, "drops": 0.75, "dropping": 0.75, "dropped": 0.75,
    "fall": 0.75, "falls": 0.75, "falling": 0.75, "fell": 0.75,
    "loss": 0.85, "losses": 0.85, "losing": 0.75, "deficit": 0.80,
    "decline": 0.75, "declines": 0.75, "declining": 0.75, "declined": 0.75,
    "lockdown": 0.92, "lockdowns": 0.92, "pandemic": 0.85, "virus": 0.75, "coronavirus": 0.80,
    "crisis": 0.88, "recession": 0.90, "bear": 0.75, "bearish": 0.80,
    "bankrupt": 0.95, "bankruptcy": 0.95, "default": 0.90, "defaults": 0.90,
    "halt": 0.80, "halts": 0.80, "halted": 0.80, "shut": 0.85, "shutdown": 0.90, "shutting": 0.85,
    "cut": 0.75, "cuts": 0.75, "cutting": 0.75, "layoff": 0.90, "layoffs": 0.90,
    "fear": 0.80, "fears": 0.80, "panic": 0.90, "warning": 0.75, "warns": 0.75,
    "emergency": 0.80, "curfew": 0.85, "curb": 0.70, "curbs": 0.70,
    "selloff": 0.88, "sell-off": 0.88, "liquidate": 0.80, "liquidation": 0.85,
    "trouble": 0.75, "risk": 0.65, "risks": 0.65, "outbreak": 0.80,
    "plummets": 0.90, "plummeting": 0.90, "downgrade": 0.80, "downgrades": 0.80
}

NEGATION_WORDS = {"not", "no", "never", "hardly", "scarcely", "barely", "without", "fails", "failed", "denies"}

# Cache global pour le modèle FinBERT HuggingFace si disponible
_FINBERT_PIPELINE = None
_FINBERT_TRIED = False

def get_finbert_pipeline():
    global _FINBERT_PIPELINE, _FINBERT_TRIED
    if _FINBERT_TRIED:
        return _FINBERT_PIPELINE
    _FINBERT_TRIED = True
    try:
        from transformers import pipeline
        # Chargement léger si transformers & modèle présents
        _FINBERT_PIPELINE = pipeline("sentiment-analysis", model="ProsusAI/finbert", return_all_scores=True)
    except Exception:
        _FINBERT_PIPELINE = None
    return _FINBERT_PIPELINE

def _clean_tokens(text: str) -> List[str]:
    # Découpage en mots minuscules alphanumériques
    return re.findall(r"\b[a-zA-Z]{2,}\b", text.lower())

def analyze_single_text(text: str, model_name: str = "FINBERT", with_explanation: bool = True, top_k: int = 8) -> Dict[str, Any]:
    """
    Analyse le sentiment d'un texte (headline + summary).
    Retourne label (POSITIVE, NEGATIVE, NEUTRAL), scores et topTokens explicatifs XAI.
    """
    clean_text = text or ""
    tokens = _clean_tokens(clean_text)

    # 1. Tentative d'utiliser FinBERT officiel si disponible
    hf_pipe = get_finbert_pipeline() if model_name.upper() == "FINBERT" else None
    if hf_pipe is not None:
        try:
            raw_res = hf_pipe(clean_text[:512])[0]
            scores_map = {}
            for item in raw_res:
                scores_map[item["label"].lower()] = float(item["score"])

            # Détermination du label dominant
            best_label = max(scores_map.items(), key=lambda x: x[1])[0].upper()
            explanation = _explain_with_lexicon(tokens, best_label, top_k) if with_explanation else None

            return {
                "label": best_label,
                "scores": {
                    "positive": round(scores_map.get("positive", 0.0), 4),
                    "neutral": round(scores_map.get("neutral", 0.0), 4),
                    "negative": round(scores_map.get("negative", 0.0), 4)
                },
                "explanation": explanation
            }
        except Exception:
            pass # Fallback sur l'analyseur financier

    # 2. Analyseur Financier Déterministe & Robuste (Lexicon + XAI)
    pos_score = 0.0
    neg_score = 0.0
    token_contributions: Dict[str, float] = {}

    is_negated = False
    for i, tok in enumerate(tokens):
        if tok in NEGATION_WORDS:
            is_negated = True
            continue

        if tok in FINANCIAL_POSITIVE_LEXICON:
            weight = FINANCIAL_POSITIVE_LEXICON[tok]
            if is_negated:
                neg_score += weight * 0.8
                token_contributions[tok] = -weight * 0.8
            else:
                pos_score += weight
                token_contributions[tok] = weight
            is_negated = False

        elif tok in FINANCIAL_NEGATIVE_LEXICON:
            weight = FINANCIAL_NEGATIVE_LEXICON[tok]
            if is_negated:
                pos_score += weight * 0.7
                token_contributions[tok] = weight * 0.7
            else:
                neg_score += weight
                token_contributions[tok] = -weight
            is_negated = False

    # Calcul des probabilités via softmax pondérée
    raw_scores = np_softmax([pos_score, 0.45, neg_score]) # 0.45 = neutral prior
    pos_p, neu_p, neg_p = raw_scores[0], raw_scores[1], raw_scores[2]

    if pos_p > neg_p and pos_p > neu_p:
        label = "POSITIVE"
    elif neg_p > pos_p and neg_p > neu_p:
        label = "NEGATIVE"
    else:
        label = "NEUTRAL"

    # Construction de l'explication XAI des top tokens
    explanation = None
    if with_explanation:
        top_tokens = []
        # Trier par magnitude d'impact (|weight|)
        sorted_tokens = sorted(token_contributions.items(), key=lambda kv: abs(kv[1]), reverse=True)[:top_k]
        for t, w in sorted_tokens:
            top_tokens.append({"token": t, "weight": round(abs(w), 4), "direction": "POSITIVE" if w > 0 else "NEGATIVE"})

        # Si aucun mot clé financier direct, extraire les mots significatifs non triviaux
        if not top_tokens:
            stopwords = {"the", "and", "for", "that", "this", "with", "from", "have", "said", "will"}
            sub = [t for t in tokens if len(t) > 3 and t not in stopwords][:top_k]
            top_tokens = [{"token": t, "weight": 0.10, "direction": "NEUTRAL"} for t in sub]

        explanation = {"topTokens": top_tokens}

    return {
        "label": label,
        "scores": {
            "positive": round(pos_p, 4),
            "neutral": round(neu_p, 4),
            "negative": round(neg_p, 4)
        },
        "explanation": explanation
    }

def _explain_with_lexicon(tokens: List[str], label: str, top_k: int) -> Dict[str, Any]:
    top_tokens = []
    seen = set()
    for t in tokens:
        if t in seen:
            continue
        if label == "NEGATIVE" and t in FINANCIAL_NEGATIVE_LEXICON:
            top_tokens.append({"token": t, "weight": FINANCIAL_NEGATIVE_LEXICON[t], "direction": "NEGATIVE"})
            seen.add(t)
        elif label == "POSITIVE" and t in FINANCIAL_POSITIVE_LEXICON:
            top_tokens.append({"token": t, "weight": FINANCIAL_POSITIVE_LEXICON[t], "direction": "POSITIVE"})
            seen.add(t)
        if len(top_tokens) >= top_k:
            break
    return {"topTokens": top_tokens}

def np_softmax(scores: List[float]) -> List[float]:
    exp_scores = [math.exp(min(s, 10.0)) for s in scores]
    s_sum = sum(exp_scores)
    return [s / s_sum for s in exp_scores]
