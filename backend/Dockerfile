FROM python:3.11-slim

WORKDIR /app

COPY backend/ .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

ENV PYTHONUNBUFFERED=1

CMD ["sh", "-c", "gunicorn -w 2 -b 0.0.0.0:${PORT:-8000} app:app"]
