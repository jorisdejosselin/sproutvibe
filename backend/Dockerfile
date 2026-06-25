FROM python:3.14-slim@sha256:63a4c7f612a00f92042cbdcc7cdc6a306f38485af0a200b9c89de7d9b1607d15

ENV POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_IN_PROJECT=true

RUN pip install --no-cache-dir poetry==2.1.1

WORKDIR /app

COPY pyproject.toml poetry.lock ./
RUN poetry install --only main --no-root

COPY . .

ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}

RUN addgroup --system --gid 1001 appuser && \
    adduser --system --uid 1001 --gid 1001 --no-create-home appuser && \
    mkdir -p /data /app/uploads && \
    chown -R appuser:appuser /app /data

USER appuser

CMD [".venv/bin/uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
