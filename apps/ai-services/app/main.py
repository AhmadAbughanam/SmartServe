import asyncio
import json
import math
import os
import re
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any, Optional

import holidays as pyholidays
import numpy as np
import pandas as pd
from fastapi import FastAPI
from pydantic import BaseModel, Field
from sklearn.ensemble import GradientBoostingRegressor, IsolationForest
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression, Ridge

app = FastAPI(
    title="Smart Restaurant AI Services",
    version="0.2.0",
    description="Assistive AI boundary for recommendations, forecasting, anomalies, and chatbot flows.",
)

MODEL_VERSION_RECOMMENDATIONS = "gradient_boosting_ranker_v1"
MODEL_VERSION_INSIGHTS = "isolation_forest_v1"
MODEL_VERSION_REVIEW_SENTIMENT = "tfidf_logreg_v1"
NEGATIVE_TERMS = {
    "cold",
    "late",
    "slow",
    "salty",
    "burnt",
    "raw",
    "stale",
    "dirty",
    "rude",
    "wrong",
    "small",
    "delay",
    "greasy",
    "bland",
}


class HealthResponse(BaseModel):
    service: str
    status: str
    timestamp: str


class MenuChatCartItem(BaseModel):
    menuItemId: str
    quantity: int = Field(ge=1)


class MenuChatMenuItem(BaseModel):
    menuItemId: str
    name: str
    description: Optional[str] = None
    dietaryInfo: Optional[str] = None
    allergens: Optional[list[str]] = None
    isVegetarian: bool = False
    isSpicy: bool = False
    category: Optional[str] = None
    isAvailable: bool = True


class MenuChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=500)
    menuItems: list[MenuChatMenuItem]
    cartItems: list[MenuChatCartItem] = Field(default_factory=list)


class MenuChatSuggestedItem(BaseModel):
    menuItemId: str
    name: str
    reason: str


class MenuChatResponse(BaseModel):
    reply: str
    suggestedItems: list[MenuChatSuggestedItem]
    safetyNotes: list[str] = Field(default_factory=list)


class RecommendationCandidateFeatures(BaseModel):
    historicalSalesCount: float = 0
    coPurchaseCount: float = 0
    reorderSignal: float = 0
    timeSignal: float = 0
    impressionCount: float = 0
    addToCartCount: float = 0
    purchasedCount: float = 0
    cartAware: float = 0
    hasUserContext: float = 0
    cartSize: float = 0
    hourOfDay: float = 0
    dayOfWeek: float = 0


class RecommendationCandidateInput(BaseModel):
    menuItemId: str
    name: str
    type: str
    reason: str
    ruleScore: float
    features: RecommendationCandidateFeatures


class MenuRecommendationInferRequest(BaseModel):
    tenantId: str
    branchId: str
    userId: Optional[str] = None
    confidenceThreshold: float = 0.55
    modelFamily: Optional[str] = None
    modelVersionPin: Optional[str] = None
    candidates: list[RecommendationCandidateInput]


class MenuRecommendationInferResult(BaseModel):
    menuItemId: str
    score: float
    confidence: float
    explanation: Optional[str] = None


class MenuRecommendationInferResponse(BaseModel):
    modelVersion: str
    confidence: float
    results: list[MenuRecommendationInferResult]


class InsightInput(BaseModel):
    category: str
    priority: str
    title: str
    description: str
    recommendedAction: Optional[str] = None
    metricValue: Optional[str] = None
    sourceMetadata: dict[str, Any] | None = None


class BusinessInsightsSummarizeRequest(BaseModel):
    scope: str
    insights: list[InsightInput]


class BusinessInsightsSummarizeResponse(BaseModel):
    summary: str


class BusinessInsightInferRequest(BaseModel):
    tenantId: str
    branchId: Optional[str] = None
    scope: str
    from_: str = Field(alias="from")
    to: str
    confidenceThreshold: float = 0.5
    modelFamily: Optional[str] = None
    modelVersionPin: Optional[str] = None
    insights: list[InsightInput]


class BusinessInsightInferResult(BaseModel):
    id: str
    priority: str
    confidence: str
    explanation: Optional[str] = None


class BusinessInsightInferResponse(BaseModel):
    modelVersion: str
    confidence: float
    results: list[BusinessInsightInferResult]


class ReviewCommonIssue(BaseModel):
    issue: str
    count: int
    severity: str


class ReviewAffectedItem(BaseModel):
    menuItemId: str
    name: str
    averageRating: float
    issueCount: int
    topIssue: Optional[str] = None


class ReviewSentimentTrendInput(BaseModel):
    previousFrom: str
    previousTo: str
    previousTotalReviews: int
    previousAverageRating: float
    averageRatingDelta: float
    reviewCountDelta: int
    currentTopIssue: Optional[str] = None
    previousTopIssue: Optional[str] = None
    topIssueChanged: bool
    direction: str


class ReviewSentimentAlertInput(BaseModel):
    type: str
    severity: str
    message: str
    issue: Optional[str] = None
    currentCount: Optional[int] = None
    previousCount: Optional[int] = None
    countDelta: Optional[int] = None
    ratingDelta: Optional[float] = None


class ReviewTimelinePointInput(BaseModel):
    from_: str = Field(alias="from")
    to: str
    reviewCount: int
    averageRating: float
    issueCount: int
    topIssue: Optional[str] = None


class ReviewItemComplaintTimelineInput(BaseModel):
    menuItemId: str
    name: str
    totalIssueCount: int
    direction: str
    points: list[ReviewTimelinePointInput]


class ReviewOperationalCorrelationsInput(BaseModel):
    reviewedOrderCount: int
    lateIssueReviewCount: int
    averageKitchenMinutes: Optional[float] = None
    lateReviewsAverageKitchenMinutes: Optional[float] = None
    averageReadyToServedMinutes: Optional[float] = None
    lateReviewsAverageReadyToServedMinutes: Optional[float] = None
    serviceRequestCount: int
    lateReviewsServiceRequestCount: int
    signal: str
    summary: str


class ReviewActionSuggestionInput(BaseModel):
    id: str
    title: str
    action: str
    reason: str
    severity: str
    relatedIssue: Optional[str] = None
    menuItemId: Optional[str] = None
    menuItemName: Optional[str] = None


class ReviewSentimentSummarizeRequest(BaseModel):
    totalReviews: int
    averageRating: float
    sentiment: str
    commonIssues: list[ReviewCommonIssue] = Field(default_factory=list)
    affectedItems: list[ReviewAffectedItem] = Field(default_factory=list)
    trend: ReviewSentimentTrendInput
    alerts: list[ReviewSentimentAlertInput] = Field(default_factory=list)
    itemTimelines: list[ReviewItemComplaintTimelineInput] = Field(default_factory=list)
    operationalCorrelations: ReviewOperationalCorrelationsInput
    actionSuggestions: list[ReviewActionSuggestionInput] = Field(default_factory=list)


class ReviewSentimentSummarizeResponse(BaseModel):
    summary: str


class ReviewInferenceItemReview(BaseModel):
    menuItemId: str
    menuItemName: str
    rating: float
    comment: Optional[str] = None


class ReviewInferenceReview(BaseModel):
    id: str
    createdAt: str
    overallRating: float
    comment: Optional[str] = None
    issueTags: list[str] = Field(default_factory=list)
    itemReviews: list[ReviewInferenceItemReview] = Field(default_factory=list)


class ReviewInferenceBaseline(BaseModel):
    sentiment: str
    commonIssues: list[ReviewCommonIssue] = Field(default_factory=list)
    affectedItems: list[ReviewAffectedItem] = Field(default_factory=list)
    itemTimelines: list[ReviewItemComplaintTimelineInput] = Field(default_factory=list)


class ReviewSentimentInferRequest(BaseModel):
    tenantId: str
    branchId: str
    from_: str = Field(alias="from")
    to: str
    menuItemId: Optional[str] = None
    confidenceThreshold: float = 0.55
    modelFamily: Optional[str] = None
    modelVersionPin: Optional[str] = None
    reviews: list[ReviewInferenceReview]
    baseline: ReviewInferenceBaseline


class ReviewSentimentInferResponse(BaseModel):
    sentiment: str
    commonIssues: list[ReviewCommonIssue]
    affectedItems: list[ReviewAffectedItem]
    itemTimelines: list[dict[str, Any]]
    confidence: float
    modelVersion: str


class DailyRecord(BaseModel):
    date: str
    quantity: float


class ItemForecastRequest(BaseModel):
    menuItemId: str
    history: list[DailyRecord]


class ForecastModelRequest(BaseModel):
    targetDate: str
    items: list[ItemForecastRequest]
    countryCode: str = "US"


class ItemForecastResult(BaseModel):
    menuItemId: str
    expectedQuantity: float


class ForecastModelResponse(BaseModel):
    items: list[ItemForecastResult]


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        service="ai-services",
        status="ok",
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@app.get("/capabilities")
async def capabilities() -> dict[str, list[str]]:
    return {
        "planned": [
            "recommendations",
            "forecasting",
            "anomaly-detection",
            "customer-chatbot",
        ]
    }


@app.post("/menu-chat", response_model=MenuChatResponse)
async def menu_chat(payload: MenuChatRequest) -> MenuChatResponse:
    message = payload.message.lower()
    cart_ids = {item.menuItemId for item in payload.cartItems}
    menu_items = [
        item
        for item in payload.menuItems
        if item.isAvailable and item.menuItemId not in cart_ids
    ]

    if not menu_items:
        return MenuChatResponse(
            reply="I could not find available menu items to suggest right now.",
            suggestedItems=[],
        )

    if any(term in message for term in ["spicy", "hot", "chili", "chilli"]):
        matches = [
            item
            for item in menu_items
            if item.isSpicy or _contains_any(item.description, ["spicy", "hot", "chili", "chilli"])
        ]
        return _response(
            "If you want something spicy, these are good fits from the current menu.",
            matches,
            "It is marked or described as spicy and available.",
        )

    if any(term in message for term in ["vegetarian", "veggie", "vegan", "plant"]):
        matches = [
            item
            for item in menu_items
            if item.isVegetarian or _contains_any(item.dietaryInfo, ["vegetarian", "vegan", "plant"])
        ]
        return _response(
            "Here are vegetarian-style options from the current menu.",
            matches,
            "It is marked with vegetarian dietary information.",
        )

    if any(term in message for term in ["light", "fresh", "salad", "small"]):
        matches = [
            item
            for item in menu_items
            if _contains_any(
                " ".join(
                    part
                    for part in [item.category, item.description, item.dietaryInfo]
                    if part
                ),
                ["light", "fresh", "salad", "starter", "grilled", "vegetarian"],
            )
        ]
        return _response(
            "These look like lighter-style options based on the current menu.",
            matches,
            "The menu description or category suggests a lighter style.",
        )

    return _response(
        "I found a few options from the current menu that may fit what you asked for.",
        menu_items,
        "Available on the current branch menu.",
    )


@app.post("/recommendations/menu/infer", response_model=MenuRecommendationInferResponse)
async def infer_menu_recommendations(
    req: MenuRecommendationInferRequest,
) -> MenuRecommendationInferResponse:
    if not req.candidates:
        return MenuRecommendationInferResponse(
            modelVersion=req.modelVersionPin or req.modelFamily or MODEL_VERSION_RECOMMENDATIONS,
            confidence=0.0,
            results=[],
        )

    feature_rows = []
    targets = []
    for candidate in req.candidates:
        features = candidate.features
        feature_rows.append(
            [
                candidate.ruleScore,
                features.historicalSalesCount,
                features.coPurchaseCount,
                features.reorderSignal,
                features.timeSignal,
                features.impressionCount,
                features.addToCartCount,
                features.purchasedCount,
                features.cartAware,
                features.hasUserContext,
                features.cartSize,
                features.hourOfDay,
                features.dayOfWeek,
            ]
        )
        targets.append(
            candidate.ruleScore * 0.4
            + features.purchasedCount * 2.8
            + features.addToCartCount * 1.8
            + features.coPurchaseCount * 1.2
            + features.reorderSignal * 2.0
            + features.timeSignal * 1.1
            - features.impressionCount * 0.08
        )

    matrix = np.array(feature_rows, dtype=float)
    model_version = req.modelVersionPin or req.modelFamily or MODEL_VERSION_RECOMMENDATIONS
    if len(req.candidates) >= 3 and np.ptp(np.array(targets, dtype=float)) > 0:
        model = GradientBoostingRegressor(random_state=42)
        model.fit(matrix, np.array(targets, dtype=float))
        raw_scores = model.predict(matrix)
    else:
        raw_scores = np.array(targets, dtype=float)

    normalized_scores = _normalize_scores(raw_scores)
    confidence = _clamp(
        0.45
        + 0.18 * min(1.0, len(req.candidates) / 8)
        + 0.22 * min(
            1.0,
            sum(candidate.features.purchasedCount for candidate in req.candidates) / 40,
        )
        + 0.1 * min(
            1.0,
            sum(candidate.features.addToCartCount for candidate in req.candidates) / 30,
        )
        + (0.05 if req.userId else 0.0),
        0.0,
        0.97,
    )

    ranked = sorted(
        zip(req.candidates, normalized_scores, raw_scores),
        key=lambda entry: float(entry[1]),
        reverse=True,
    )
    return MenuRecommendationInferResponse(
        modelVersion=model_version,
        confidence=round(confidence, 4),
        results=[
            MenuRecommendationInferResult(
                menuItemId=candidate.menuItemId,
                score=round(float(score), 4),
                confidence=round(confidence, 4),
                explanation=_build_recommendation_explanation(candidate),
            )
            for candidate, score, _raw in ranked
        ],
    )


@app.post("/business-insights/infer", response_model=BusinessInsightInferResponse)
async def infer_business_insights(
    req: BusinessInsightInferRequest,
) -> BusinessInsightInferResponse:
    if not req.insights:
        return BusinessInsightInferResponse(
            modelVersion=req.modelVersionPin or req.modelFamily or MODEL_VERSION_INSIGHTS,
            confidence=0.0,
            results=[],
        )

    feature_rows = []
    heuristic_scores = []
    for insight in req.insights:
        source = insight.sourceMetadata or {}
        current_value = _to_number(source.get("currentValue"))
        threshold_value = _to_number(source.get("threshold"))
        gap = current_value - threshold_value if threshold_value is not None else current_value
        priority_weight = {"LOW": 1.0, "MEDIUM": 2.0, "HIGH": 3.0}.get(
            insight.priority,
            1.0,
        )
        category_weight = {
            "OPERATIONS": 1.2,
            "KITCHEN": 1.25,
            "INVENTORY": 1.15,
            "REVIEWS": 1.1,
            "SALES": 1.0,
            "MENU": 0.9,
        }.get(insight.category, 1.0)
        feature_rows.append(
            [
                priority_weight,
                category_weight,
                current_value,
                threshold_value,
                gap,
                float(len(source.get("sourceMetrics", []) or [])),
                1.0 if source.get("affectedBranchIds") else 0.0,
            ]
        )
        heuristic_scores.append(priority_weight * category_weight + max(0.0, gap))

    matrix = np.array(feature_rows, dtype=float)
    model_version = req.modelVersionPin or req.modelFamily or MODEL_VERSION_INSIGHTS
    if len(req.insights) >= 3:
        model = IsolationForest(random_state=42, contamination="auto")
        model.fit(matrix)
        anomaly_scores = -model.score_samples(matrix)
    else:
        anomaly_scores = np.array(heuristic_scores, dtype=float)

    combined_scores = anomaly_scores + np.array(heuristic_scores, dtype=float) * 0.08
    normalized = _normalize_scores(combined_scores)
    confidence = _clamp(
        0.5
        + 0.2 * min(1.0, len(req.insights) / 6)
        + 0.18 * float(np.std(combined_scores) > 0.05),
        0.0,
        0.95,
    )

    ranked = sorted(
        zip(req.insights, normalized),
        key=lambda entry: float(entry[1]),
        reverse=True,
    )
    return BusinessInsightInferResponse(
        modelVersion=model_version,
        confidence=round(confidence, 4),
        results=[
            BusinessInsightInferResult(
                id=insight.id,
                priority=_priority_from_score(float(score)),
                confidence=_confidence_band(float(score)),
                explanation=_build_insight_explanation(insight),
            )
            for insight, score in ranked
        ],
    )


@app.post("/business-insights/summarize", response_model=BusinessInsightsSummarizeResponse)
async def summarize_business_insights(
    req: BusinessInsightsSummarizeRequest,
) -> BusinessInsightsSummarizeResponse:
    fallback_summary = (
        f"Your {req.scope.lower()} requires attention on {len(req.insights)} key operational areas, "
        f"notably {req.insights[0].title.lower() if req.insights else 'general performance'}."
    )

    hf_token = os.getenv("HF_TOKEN")
    hf_model = os.getenv("HF_MODEL", "meta-llama/Llama-3.1-8B-Instruct:fastest")
    hf_base_url = os.getenv("HF_BASE_URL", "https://router.huggingface.co/v1")

    if not hf_token or not req.insights:
        return BusinessInsightsSummarizeResponse(summary=fallback_summary)

    insights_text = "\n".join(
        [
            f"- [{i.priority}] {i.title}: {i.description} (Metric: {i.metricValue or 'N/A'})"
            for i in req.insights
        ]
    )

    system_message = (
        "You are an executive AI assistant for a restaurant manager. "
        "Write a concise, professional 2-sentence summary of the following operational alerts. "
        "Focus on the most critical (HIGH priority) issues first. "
        "Do not invent any numbers, metrics, or insights that are not provided. "
        "Output ONLY a valid JSON object with a single key 'summary'."
    )
    user_message = f"Scope: {req.scope}\nInsights:\n{insights_text}"
    payload = {
        "model": hf_model,
        "messages": [
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message},
        ],
        "temperature": 0.3,
        "max_tokens": 150,
        "response_format": {"type": "json_object"},
    }

    try:
        data = await asyncio.to_thread(
            _call_hf_sync, f"{hf_base_url}/chat/completions", hf_token, payload
        )
        content = data["choices"][0]["message"]["content"]
        result = json.loads(content)
        if "summary" in result and isinstance(result["summary"], str):
            return BusinessInsightsSummarizeResponse(summary=result["summary"].strip())
    except Exception:
        pass

    return BusinessInsightsSummarizeResponse(summary=fallback_summary)


@app.post("/review-sentiment/infer", response_model=ReviewSentimentInferResponse)
async def infer_review_sentiment(
    req: ReviewSentimentInferRequest,
) -> ReviewSentimentInferResponse:
    if not req.reviews:
        return ReviewSentimentInferResponse(
            sentiment=req.baseline.sentiment,
            commonIssues=req.baseline.commonIssues,
            affectedItems=req.baseline.affectedItems,
            itemTimelines=[point.model_dump(by_alias=True) for point in req.baseline.itemTimelines],
            confidence=0.0,
            modelVersion=req.modelVersionPin or req.modelFamily or MODEL_VERSION_REVIEW_SENTIMENT,
        )

    review_texts = [_review_text(review) for review in req.reviews]
    weak_labels = [_weak_review_label(review.overallRating) for review in req.reviews]
    class_count = len(set(weak_labels))
    probabilities = None
    if len(req.reviews) >= 4 and class_count >= 2:
        try:
            vectorizer = TfidfVectorizer(
                ngram_range=(1, 2),
                min_df=1,
                max_features=500,
                stop_words="english",
            )
            matrix = vectorizer.fit_transform(review_texts)
            model = LogisticRegression(
                max_iter=300,
                multi_class="auto",
                random_state=42,
            )
            model.fit(matrix, weak_labels)
            probabilities = model.predict_proba(matrix)
            classes = list(model.classes_)
        except Exception:
            probabilities = None
            classes = []
    else:
        classes = []

    if probabilities is None:
        probabilities = np.array([_fallback_sentiment_probs(review) for review in req.reviews])
        classes = [0, 1, 2]

    avg_probs = probabilities.mean(axis=0)
    predicted_label = classes[int(np.argmax(avg_probs))]
    sentiment = {0: "NEGATIVE", 1: "NEUTRAL", 2: "POSITIVE"}.get(predicted_label, "MIXED")
    positive_share = float(avg_probs[classes.index(2)]) if 2 in classes else 0.0
    negative_share = float(avg_probs[classes.index(0)]) if 0 in classes else 0.0
    if positive_share > 0.28 and negative_share > 0.28:
        sentiment = "MIXED"

    common_issues = _derive_review_common_issues(req.reviews, probabilities, classes)
    affected_items = _derive_review_affected_items(req.reviews, probabilities, classes)
    item_timelines = _derive_review_item_timelines(req.reviews)
    confidence = _clamp(
        0.48
        + 0.18 * min(1.0, len(req.reviews) / 8)
        + 0.14 * min(1.0, sum(1 for text in review_texts if text.strip()) / max(len(review_texts), 1))
        + 0.16 * abs(positive_share - negative_share),
        0.0,
        0.96,
    )

    return ReviewSentimentInferResponse(
        sentiment=sentiment,
        commonIssues=common_issues or req.baseline.commonIssues,
        affectedItems=affected_items or req.baseline.affectedItems,
        itemTimelines=item_timelines
        or [timeline.model_dump(by_alias=True) for timeline in req.baseline.itemTimelines],
        confidence=round(confidence, 4),
        modelVersion=req.modelVersionPin or req.modelFamily or MODEL_VERSION_REVIEW_SENTIMENT,
    )


@app.post("/review-sentiment/summarize", response_model=ReviewSentimentSummarizeResponse)
async def summarize_review_sentiment(
    req: ReviewSentimentSummarizeRequest,
) -> ReviewSentimentSummarizeResponse:
    common_issues = [issue.issue for issue in req.commonIssues[:2]]
    affected_items = [item.name for item in req.affectedItems[:2]]
    top_alert = req.alerts[0].message if req.alerts else None
    operational_summary = req.operationalCorrelations.summary.strip()

    if req.totalReviews == 0:
        return ReviewSentimentSummarizeResponse(
            summary="No customer reviews were found for this period."
        )

    if req.sentiment == "POSITIVE":
        summary = (
            f"Customer feedback is positive for this period. "
            f"Average rating is {req.averageRating:.2f} across {req.totalReviews} reviews."
        )
    elif req.sentiment == "NEUTRAL":
        summary = (
            f"Customer feedback is generally neutral for this period. "
            f"Average rating is {req.averageRating:.2f} across {req.totalReviews} reviews."
        )
    else:
        summary = (
            f"Customer feedback is {req.sentiment.lower()} for this period. "
            f"Average rating is {req.averageRating:.2f} across {req.totalReviews} reviews."
        )

    if common_issues:
        if len(common_issues) == 1:
            summary += f" The main recurring issue is {common_issues[0]}."
        else:
            summary += (
                f" The main recurring issues are {common_issues[0]} and {common_issues[1]}."
            )

    if affected_items:
        if len(affected_items) == 1:
            summary += f" Feedback is most concentrated around {affected_items[0]}."
        else:
            summary += (
                f" Feedback is most concentrated around {affected_items[0]} and {affected_items[1]}."
            )

    if req.trend.direction == "IMPROVING":
        summary += (
            f" Average rating improved by {req.trend.averageRatingDelta:.2f} points "
            f"versus the previous period."
        )
    elif req.trend.direction == "DECLINING":
        summary += (
            f" Average rating declined by {abs(req.trend.averageRatingDelta):.2f} points "
            f"versus the previous period."
        )
    elif req.trend.direction == "STABLE":
        summary += " Average rating is stable versus the previous period."

    if top_alert:
        summary += f" Alert: {top_alert}"

    if operational_summary:
        summary += f" {operational_summary}"

    summary = " ".join(summary.split())
    return ReviewSentimentSummarizeResponse(summary=summary[:600])


@app.post("/forecast/demand", response_model=ForecastModelResponse)
async def forecast_demand(req: ForecastModelRequest) -> ForecastModelResponse:
    target_dt = pd.to_datetime(req.targetDate).date()
    country_holidays = pyholidays.country_holidays(req.countryCode)
    results = []

    for item in req.items:
        if len(item.history) < 3:
            avg = (
                sum(record.quantity for record in item.history) / len(item.history)
                if item.history
                else 0.0
            )
            results.append(
                ItemForecastResult(menuItemId=item.menuItemId, expectedQuantity=avg)
            )
            continue

        df = pd.DataFrame([{"date": record.date, "y": record.quantity} for record in item.history])
        df["date"] = pd.to_datetime(df["date"]).dt.date
        df = df.groupby("date", as_index=False)["y"].sum()
        df = df.sort_values("date")
        df["dayofweek"] = pd.to_datetime(df["date"]).dt.dayofweek
        df["is_holiday"] = df["date"].apply(lambda date_value: int(date_value in country_holidays))
        df["trend"] = np.arange(len(df))

        features = pd.DataFrame()
        for index in range(7):
            features[f"dow_{index}"] = (df["dayofweek"] == index).astype(int)
        features["is_holiday"] = df["is_holiday"]
        features["trend"] = df["trend"]
        target = df["y"]

        model = Ridge(alpha=1.0)
        model.fit(features, target)

        target_pd_dt = pd.to_datetime(req.targetDate)
        target_dow = target_pd_dt.dayofweek
        target_is_holiday = int(target_dt in country_holidays)
        target_trend = len(df)

        prediction_features = pd.DataFrame()
        for index in range(7):
            prediction_features[f"dow_{index}"] = [1 if index == target_dow else 0]
        prediction_features["is_holiday"] = [target_is_holiday]
        prediction_features["trend"] = [target_trend]

        prediction = model.predict(prediction_features)[0]
        predicted_quantity = max(0.0, float(prediction))
        results.append(
            ItemForecastResult(
                menuItemId=item.menuItemId,
                expectedQuantity=predicted_quantity,
            )
        )

    return ForecastModelResponse(items=results)


def _contains_any(value: Optional[str], terms: list[str]) -> bool:
    if not value:
        return False
    normalized = value.lower()
    return any(term in normalized for term in terms)


def _response(
    reply: str,
    items: list[MenuChatMenuItem],
    reason: str,
) -> MenuChatResponse:
    return MenuChatResponse(
        reply=reply,
        suggestedItems=[
            MenuChatSuggestedItem(
                menuItemId=item.menuItemId,
                name=item.name,
                reason=reason,
            )
            for item in items[:5]
        ],
    )


def _call_hf_sync(url: str, token: str, payload: dict) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode("utf-8"))


def _normalize_scores(values: np.ndarray) -> np.ndarray:
    if len(values) == 0:
        return np.array([], dtype=float)
    if np.allclose(values.max(), values.min()):
        return np.full(len(values), 0.5, dtype=float)
    scaled = (values - values.min()) / (values.max() - values.min())
    return scaled * 0.49 + 0.5


def _build_recommendation_explanation(candidate: RecommendationCandidateInput) -> str:
    signals = []
    features = candidate.features
    if features.purchasedCount > 0:
        signals.append("strong purchase history")
    if features.addToCartCount > 0:
        signals.append("cart conversion signal")
    if features.coPurchaseCount > 0:
        signals.append("paired with similar orders")
    if features.reorderSignal > 0:
        signals.append("repeat-order signal")
    if features.timeSignal > 0:
        signals.append("time-of-day fit")
    if not signals:
        signals.append("branch popularity baseline")
    return ", ".join(signals[:3])


def _to_number(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        match = re.search(r"-?\d+(?:\.\d+)?", value)
        return float(match.group(0)) if match else 0.0
    return 0.0


def _priority_from_score(score: float) -> str:
    if score >= 0.83:
        return "HIGH"
    if score >= 0.66:
        return "MEDIUM"
    return "LOW"


def _confidence_band(score: float) -> str:
    if score >= 0.82:
        return "HIGH"
    if score >= 0.62:
        return "MEDIUM"
    return "LOW"


def _build_insight_explanation(insight: InsightInput) -> str:
    source = insight.sourceMetadata or {}
    metrics = source.get("sourceMetrics")
    if isinstance(metrics, list) and metrics:
        metric_name = str(metrics[0]).replace("_", " ")
        return f"Ranked higher due to {metric_name} deviation."
    return f"Ranked from {insight.category.lower()} risk pattern."


def _review_text(review: ReviewInferenceReview) -> str:
    parts = [review.comment or ""]
    parts.extend(review.issueTags)
    parts.extend(item.comment or "" for item in review.itemReviews)
    return " ".join(part.strip() for part in parts if part and part.strip())


def _weak_review_label(rating: float) -> int:
    if rating <= 2.5:
        return 0
    if rating < 4.0:
        return 1
    return 2


def _fallback_sentiment_probs(review: ReviewInferenceReview) -> list[float]:
    text = _review_text(review).lower()
    negative_hits = sum(1 for term in NEGATIVE_TERMS if term in text)
    if review.overallRating <= 2.5 or negative_hits >= 2:
        return [0.78, 0.17, 0.05]
    if review.overallRating < 4.0 or negative_hits == 1:
        return [0.24, 0.58, 0.18]
    return [0.05, 0.2, 0.75]


def _derive_review_common_issues(
    reviews: list[ReviewInferenceReview],
    probabilities: np.ndarray,
    classes: list[int],
) -> list[ReviewCommonIssue]:
    negative_index = classes.index(0) if 0 in classes else 0
    weighted_counts: defaultdict[str, float] = defaultdict(float)
    token_counts: Counter[str] = Counter()

    for index, review in enumerate(reviews):
        negative_weight = float(probabilities[index][negative_index])
        for tag in review.issueTags:
            normalized = tag.strip().lower().replace("_", " ")
            if normalized:
                weighted_counts[normalized] += 1.0 + negative_weight
        if not review.issueTags and negative_weight > 0.45:
            for token in _text_tokens(_review_text(review)):
                if token in NEGATIVE_TERMS:
                    token_counts[token] += 1

    for token, count in token_counts.items():
        weighted_counts[token] += float(count)

    ranked = sorted(weighted_counts.items(), key=lambda item: (-item[1], item[0]))
    issues = []
    for issue, weighted in ranked[:5]:
        count = max(1, int(round(weighted)))
        severity = "HIGH" if count >= 5 else "MEDIUM" if count >= 3 else "LOW"
        issues.append(ReviewCommonIssue(issue=issue, count=count, severity=severity))
    return issues


def _derive_review_affected_items(
    reviews: list[ReviewInferenceReview],
    probabilities: np.ndarray,
    classes: list[int],
) -> list[ReviewAffectedItem]:
    negative_index = classes.index(0) if 0 in classes else 0
    item_stats: dict[str, dict[str, Any]] = {}
    for index, review in enumerate(reviews):
        negative_weight = float(probabilities[index][negative_index])
        review_issues = [tag.strip().lower().replace("_", " ") for tag in review.issueTags if tag.strip()]
        for item_review in review.itemReviews:
            entry = item_stats.setdefault(
                item_review.menuItemId,
                {
                    "name": item_review.menuItemName,
                    "ratings": [],
                    "issue_score": 0.0,
                    "issue_counts": Counter(),
                },
            )
            entry["ratings"].append(item_review.rating)
            if item_review.rating <= 3.5 or negative_weight >= 0.45:
                entry["issue_score"] += max(1.0, negative_weight * 2.0)
                for issue in review_issues:
                    entry["issue_counts"][issue] += 1
                if not review_issues:
                    for token in _text_tokens(item_review.comment or review.comment or ""):
                        if token in NEGATIVE_TERMS:
                            entry["issue_counts"][token] += 1

    results = []
    for menu_item_id, entry in item_stats.items():
        if entry["issue_score"] <= 0:
            continue
        average_rating = sum(entry["ratings"]) / max(len(entry["ratings"]), 1)
        top_issue = entry["issue_counts"].most_common(1)[0][0] if entry["issue_counts"] else None
        results.append(
            ReviewAffectedItem(
                menuItemId=menu_item_id,
                name=entry["name"],
                averageRating=round(float(average_rating), 2),
                issueCount=max(1, int(round(entry["issue_score"]))),
                topIssue=top_issue,
            )
        )
    results.sort(key=lambda item: (-item.issueCount, item.averageRating, item.name))
    return results[:10]


def _derive_review_item_timelines(reviews: list[ReviewInferenceReview]) -> list[dict[str, Any]]:
    if not reviews:
        return []

    sorted_reviews = sorted(reviews, key=lambda review: review.createdAt)
    day_values = [datetime.fromisoformat(review.createdAt.replace("Z", "+00:00")) for review in sorted_reviews]
    start = day_values[0].date()
    end = day_values[-1].date()
    total_days = max((end - start).days + 1, 1)
    bucket_count = min(4, total_days)
    bucket_size = max(1, math.ceil(total_days / bucket_count))

    by_item: dict[str, dict[str, Any]] = {}
    for review, review_date in zip(sorted_reviews, day_values):
        bucket_index = min(((review_date.date() - start).days) // bucket_size, bucket_count - 1)
        review_issues = [tag.strip().lower().replace("_", " ") for tag in review.issueTags if tag.strip()]
        for item_review in review.itemReviews:
            item_entry = by_item.setdefault(
                item_review.menuItemId,
                {
                    "name": item_review.menuItemName,
                    "buckets": [
                        {
                            "ratings": [],
                            "issueCount": 0,
                            "issueCounts": Counter(),
                        }
                        for _ in range(bucket_count)
                    ],
                },
            )
            bucket = item_entry["buckets"][bucket_index]
            bucket["ratings"].append(item_review.rating)
            if item_review.rating <= 3.5 or review_issues:
                bucket["issueCount"] += max(1, len(review_issues))
                for issue in review_issues:
                    bucket["issueCounts"][issue] += 1

    timelines = []
    for menu_item_id, entry in by_item.items():
        points = []
        total_issue_count = 0
        first_issue_count = None
        last_issue_count = None
        for index, bucket in enumerate(entry["buckets"]):
            point_start = start + pd.Timedelta(days=index * bucket_size)
            point_end = min(end, point_start + pd.Timedelta(days=bucket_size - 1))
            average_rating = (
                round(sum(bucket["ratings"]) / len(bucket["ratings"]), 2)
                if bucket["ratings"]
                else 0.0
            )
            issue_count = int(bucket["issueCount"])
            total_issue_count += issue_count
            if first_issue_count is None:
                first_issue_count = issue_count
            last_issue_count = issue_count
            top_issue = bucket["issueCounts"].most_common(1)[0][0] if bucket["issueCounts"] else None
            points.append(
                {
                    "from": point_start.isoformat(),
                    "to": point_end.isoformat(),
                    "reviewCount": len(bucket["ratings"]),
                    "averageRating": average_rating,
                    "issueCount": issue_count,
                    "topIssue": top_issue,
                }
            )

        if total_issue_count <= 0:
            continue
        direction = "STABLE"
        if last_issue_count is not None and first_issue_count is not None:
            if last_issue_count > first_issue_count:
                direction = "WORSENING"
            elif last_issue_count < first_issue_count:
                direction = "IMPROVING"
        timelines.append(
            {
                "menuItemId": menu_item_id,
                "name": entry["name"],
                "totalIssueCount": total_issue_count,
                "direction": direction,
                "points": points,
            }
        )

    timelines.sort(key=lambda item: (-item["totalIssueCount"], item["name"]))
    return timelines[:5]


def _text_tokens(value: str) -> list[str]:
    return re.findall(r"[a-zA-Z][a-zA-Z-]{2,}", value.lower())


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))
