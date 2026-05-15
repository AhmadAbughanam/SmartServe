# ── AI Services — Python FastAPI ─────────────────────
FROM python:3.12-slim

WORKDIR /app

# Install dependencies first for layer caching
COPY apps/ai-services/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY apps/ai-services/app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
