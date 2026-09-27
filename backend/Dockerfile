FROM python:3.12-slim AS builder

WORKDIR /build

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt ./requirements.txt
# Keep the shared dependency pins, but omit test runners from the runtime.
RUN pip install --no-cache-dir -r requirements.txt \
    && pip uninstall --yes pytest pytest-cov coverage

FROM python:3.12-slim AS runtime

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN groupadd --system --gid 10001 civicpulse \
    && useradd --system --uid 10001 --gid civicpulse --no-create-home civicpulse

COPY --from=builder /opt/venv /opt/venv
COPY app/ ./app/
COPY alembic.ini ./alembic.ini
COPY alembic/ ./alembic/

USER 10001:10001

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3).close()"]

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
