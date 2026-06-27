import asyncio
import json
import os
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(
    title="Smart Restaurant AI Services",
    version="0.1.0",
    description="Assistive AI boundary for recommendations, forecasting, anomalies, and chatbot flows.",
)


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


class InsightInput(BaseModel):
    category: str
    priority: str
    title: str
    description: str
    metricValue: Optional[str] = None


class BusinessInsightsSummarizeRequest(BaseModel):
    scope: str
    insights: list[InsightInput]


class BusinessInsightsSummarizeResponse(BaseModel):
    summary: str


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
    """Synchronous HTTP call to Hugging Face using built-in urllib."""
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


@app.post("/business-insights/summarize", response_model=BusinessInsightsSummarizeResponse)
async def summarize_business_insights(
    req: BusinessInsightsSummarizeRequest,
) -> BusinessInsightsSummarizeResponse:
    
    fallback_summary = f"Your {req.scope.lower()} requires attention on {len(req.insights)} key operational areas, notably {req.insights[0].title.lower() if req.insights else 'general performance'}."
    
    hf_token = os.getenv("HF_TOKEN")
    hf_model = os.getenv("HF_MODEL", "meta-llama/Llama-3.1-8B-Instruct:fastest")
    hf_base_url = os.getenv("HF_BASE_URL", "https://router.huggingface.co/v1")

    if not hf_token or not req.insights:
        return BusinessInsightsSummarizeResponse(summary=fallback_summary)

    # 1. Structure the raw deterministic insights into readable text for the LLM
    insights_text = "\n".join(
        [f"- [{i.priority}] {i.title}: {i.description} (Metric: {i.metricValue or 'N/A'})" for i in req.insights]
    )

    # 2. Strict system prompt forcing a concise executive summary and JSON output
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
        "temperature": 0.3, # Low temperature for factual consistency
        "max_tokens": 150,
        "response_format": {"type": "json_object"}
    }

    try:
        # 3. Execute HTTP call in a background thread to prevent blocking the async event loop
        data = await asyncio.to_thread(
            _call_hf_sync, f"{hf_base_url}/chat/completions", hf_token, payload
        )
        
        content = data["choices"][0]["message"]["content"]
        result = json.loads(content)
        
        if "summary" in result and isinstance(result["summary"], str):
            return BusinessInsightsSummarizeResponse(summary=result["summary"].strip())
    except Exception:
        pass # Catch LLM HTTP, JSON decode, and provider errors silently

    # 4. Graceful fallback if the LLM boundary fails
    return BusinessInsightsSummarizeResponse(summary=fallback_summary)


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

# --- Demand Forecasting ML Engine ---

import pandas as pd
import numpy as np
from sklearn.linear_model import Ridge
import holidays as pyholidays

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

@app.post("/forecast/demand", response_model=ForecastModelResponse)
async def forecast_demand(req: ForecastModelRequest) -> ForecastModelResponse:
    target_dt = pd.to_datetime(req.targetDate).date()
    country_holidays = pyholidays.country_holidays(req.countryCode)
    
    results = []
    
    for item in req.items:
        if len(item.history) < 3:
            # Not enough data for ML, fallback to average if any
            avg = sum(r.quantity for r in item.history) / len(item.history) if item.history else 0.0
            results.append(ItemForecastResult(menuItemId=item.menuItemId, expectedQuantity=avg))
            continue
            
        df = pd.DataFrame([{"date": r.date, "y": r.quantity} for r in item.history])
        df["date"] = pd.to_datetime(df["date"]).dt.date
        
        # Aggregate by date just in case
        df = df.groupby("date", as_index=False)["y"].sum()
        df = df.sort_values("date")
        
        # Feature Engineering
        df["dayofweek"] = pd.to_datetime(df["date"]).dt.dayofweek
        df["is_holiday"] = df["date"].apply(lambda d: int(d in country_holidays))
        df["trend"] = np.arange(len(df))
        
        X = pd.DataFrame()
        for i in range(7):
            X[f"dow_{i}"] = (df["dayofweek"] == i).astype(int)
            
        X["is_holiday"] = df["is_holiday"]
        X["trend"] = df["trend"]
        y = df["y"]
        
        # Train Ridge Regression (adds regularization to prevent overfitting on sparse data)
        model = Ridge(alpha=1.0)
        model.fit(X, y)
        
        # Predict
        target_pd_dt = pd.to_datetime(req.targetDate)
        target_dow = target_pd_dt.dayofweek
        target_is_holiday = int(target_dt in country_holidays)
        target_trend = len(df) # next step conceptually
        
        X_pred = pd.DataFrame()
        for i in range(7):
            X_pred[f"dow_{i}"] = [1 if i == target_dow else 0]
        X_pred["is_holiday"] = [target_is_holiday]
        X_pred["trend"] = [target_trend]
        
        pred = model.predict(X_pred)[0]
        pred_qty = max(0.0, float(pred)) # no negative demand
        
        results.append(ItemForecastResult(menuItemId=item.menuItemId, expectedQuantity=pred_qty))
        
    return ForecastModelResponse(items=results)
