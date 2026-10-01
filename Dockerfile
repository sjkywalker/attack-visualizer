FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    ATTVIZ_ATTACK_VERSION=19.2 \
    ATTVIZ_ATTACK_DATA=/app/data/attack/enterprise-attack.json \
    ATTVIZ_CAMPAIGN_DIR=/app/data/campaigns

WORKDIR /app

COPY requirements.txt ./
RUN python -m pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY config ./config
COPY .env ./.env
COPY ATTVIZ.png ./ATTVIZ.png
COPY LICENSE NOTICE.md ./
COPY data/attack ./data/attack
COPY data/campaigns ./data/campaigns

RUN addgroup --system --gid 10001 attviz \
    && adduser --system --uid 10001 --ingroup attviz --home /app attviz \
    && chown -R attviz:attviz /app/data/campaigns

USER attviz

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["python", "-c", "import urllib.request; from app.server import configured_port; urllib.request.urlopen(f'http://127.0.0.1:{configured_port()}/healthz', timeout=3)"]

CMD ["python", "-m", "app.server", "--host", "0.0.0.0"]
