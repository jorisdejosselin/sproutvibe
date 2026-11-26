FROM python:3.14-slim@sha256:22eafb370920ad8b429e0aec3fff433e0669968519f5d60469d83729c138b28b

WORKDIR /app

COPY pyproject.toml .
COPY sprout_mcp/ sprout_mcp/

RUN pip install --no-cache-dir .

ENV SPROUT_URL=""
ENV SPROUT_EMAIL=""
ENV SPROUT_PASSWORD=""

ENTRYPOINT ["sprout-mcp"]
