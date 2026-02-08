FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && pip install --no-cache-dir "uvicorn[standard]"

COPY . .
ENV PYTHONUNBUFFERED=1

CMD ["sh", "-c", "python -m uvicorn whatsapp_auth.app:app --host 0.0.0.0 --port ${PORT:-8000}"]
